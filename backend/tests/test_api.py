from pathlib import Path

import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient

from database import connect, db_path, read_table
from main import create_app
from tests.conftest import PASSWORD, login

EXAM = 'EXAM_G9_03'


def read_db(data_dir: Path, table: str) -> pd.DataFrame:
    con = connect(db_path(data_dir))
    try:
        return read_table(con, table)
    finally:
        con.close()


def answer_key(data_dir: Path) -> dict[str, str]:
    q = pd.read_csv(data_dir / 'Dữ liệu mẫu - question.csv')
    q = q[q['exam_id'] == EXAM]
    return dict(zip(q['question_id'], q['correct_opt'], strict=True))


def test_classes_and_students(teacher: TestClient) -> None:
    # Dữ liệu thu từ một lớp thật: khối 9, nhóm 2 (nhóm khá của trung tâm)
    assert teacher.get('/api/classes').json() == ['9 - Nhóm 2']
    students = teacher.get('/api/students', params={'class_name': '9 - Nhóm 2'}).json()
    assert len(students) == 34
    assert {'student_id': 'STU00006', 'full_name': 'Nguyễn Hà Nhi', 'class_name': '9 - Nhóm 2'} in students


def test_questions_hide_answer_key(student: TestClient) -> None:
    questions = student.get(f'/api/exams/{EXAM}/questions').json()
    assert [q['question_no'] for q in questions] == list(range(1, 41))
    assert set(questions[0]) == {
        'question_id',
        'question_no',
        'question_text',
        'options',
        'passage',
        'media',
        'underline',
    }


def test_questions_carry_filled_passages_only(student: TestClient) -> None:
    by_no = {q['question_no']: q['passage'] for q in student.get(f'/api/exams/{EXAM}/questions').json()}
    assert by_no[26]['passage_id'] == 'P_G903_26' and by_no[30]['passage_id'] == 'P_G903_26'
    assert by_no[26]['text'].startswith('In the past, traveling')
    assert by_no[25] is None
    g901 = {q['question_no']: q['passage'] for q in student.get('/api/exams/EXAM_G9_01/questions').json()}
    assert g901[14]['passage_id'] == 'P_G901_13' and g901[12] is None


def test_student_history_newest_first(student: TestClient) -> None:
    attempts = student.get('/api/attempts').json()
    assert [(a['exam']['exam_id'], a['total_score']) for a in attempts] == [('EXAM_G9_03', 8.5), ('EXAM_G9_02', 6.75)]
    assert all(a['diagnosed'] for a in attempts)
    assert attempts[0]['correct_count'] == 34


def test_diagnosis_endpoint(teacher: TestClient) -> None:
    body = teacher.get('/api/attempts/ATT_003/diagnosis').json()
    assert body['status'] == 'DIAGNOSED'
    assert [r['material_id'] for r in body['recommendations']] == ['MAT_CD05', 'MAT_PHON_STRESS', 'MAT_READ_GAPPED_02']
    assert len(teacher.get('/api/attempts/ATT_003/diagnosis', params={'top_k': 5}).json()['recommendations']) <= 5
    assert body['rules_version'] == 'v4'
    assert body['group_stats'] and all(r['reason'] for r in body['recommendations'])


def test_web_always_uses_current_rules(teacher: TestClient) -> None:
    body = teacher.get('/api/attempts/ATT_003/diagnosis', params={'rules': 'v3'}).json()
    assert body['rules_version'] == 'v4'


def test_submit_grades_notifies_teacher_and_persists(
    app: FastAPI, student: TestClient, teacher: TestClient, data_dir: Path
) -> None:
    key = answer_key(data_dir)
    answers: dict[str, str | None] = dict(key)
    wrong = list(key)[:4]
    for qid in wrong[:3]:
        answers[qid] = 'A' if key[qid] != 'A' else 'B'
    answers[wrong[3]] = None  # bỏ trống tính là sai

    # Cùng một TestClient (một event loop): mở WebSocket bằng phiên giáo viên rồi đăng nhập lại thành học sinh để nộp
    shared = login(app, 'teacher', 'gv.khoi9')
    with shared.websocket_connect('/ws/teacher') as ws:
        shared.post('/api/auth/login', json={'role': 'student', 'username': 'STU00006', 'password': PASSWORD})
        resp = shared.post('/api/attempts', json={'exam_id': EXAM, 'answers': answers})
        pushed = ws.receive_json()

    assert resp.status_code == 201
    attempt = resp.json()['attempt']
    assert attempt['student']['student_id'] == 'STU00006'
    assert attempt['total_score'] == 9.0
    assert attempt['correct_count'] == 36
    assert attempt['diagnosed'] is False
    assert pushed['type'] == 'notification'
    assert pushed['data']['attempt']['attempt_id'] == attempt['attempt_id']
    assert pushed['data']['read'] is False

    student.post(f'/api/attempts/{attempt["attempt_id"]}/diagnosis')
    assert student.get(f'/api/attempts/{attempt["attempt_id"]}').json()['diagnosed'] is True

    # Khởi động lại server: dữ liệu và phiên đăng nhập vẫn còn
    reloaded = create_app(data_dir)
    teacher_again = TestClient(reloaded, cookies=teacher.cookies)
    assert teacher_again.get(f'/api/attempts/{attempt["attempt_id"]}').json()['diagnosed'] is True
    assert teacher_again.get('/api/notifications').json()[0]['attempt']['attempt_id'] == attempt['attempt_id']
    assert login(reloaded, 'student', 'STU00006').get('/api/attempts').json()[0]['attempt_id'] == attempt['attempt_id']


def test_submit_rejects_bad_input(student: TestClient) -> None:
    bad_question = student.post('/api/attempts', json={'exam_id': EXAM, 'answers': {'G901_Q01': 'A'}})
    assert bad_question.status_code == 422
    bad_option = student.post('/api/attempts', json={'exam_id': EXAM, 'answers': {'G903_Q01': 'E'}})
    assert bad_option.status_code == 422
    unknown_exam = student.post('/api/attempts', json={'exam_id': 'EXAM_X', 'answers': {}})
    assert unknown_exam.status_code == 404


def test_notifications_read_flags(app: FastAPI, teacher: TestClient) -> None:
    other = login(app, 'student', 'STU00008')
    for _ in range(2):
        other.post('/api/attempts', json={'exam_id': EXAM, 'answers': {}})
    first, second = teacher.get('/api/notifications').json()
    assert teacher.post(f'/api/notifications/{second["id"]}/read').status_code == 204
    assert [n['read'] for n in teacher.get('/api/notifications').json()] == [False, True]
    teacher.post('/api/notifications/read-all')
    assert all(n['read'] for n in teacher.get('/api/notifications').json())
    assert teacher.post('/api/notifications/NOTI_999/read').status_code == 404


def test_unknown_ids_return_404(teacher: TestClient) -> None:
    assert teacher.get('/api/attempts/ATT_999').status_code == 404
    assert teacher.get('/api/exams/EXAM_X/questions').status_code == 404
    assert teacher.get('/api/students/STU_X').status_code == 404


def test_material_content(student: TestClient) -> None:
    body = student.get('/api/materials/MAT_COMP_01').json()
    assert body['title'] == 'Cấu trúc so sánh bằng, hơn và hơn nhất cơ bản'
    assert body['exercise_sets'][0]['questions'][0]['answer'] in 'ABCD'
    assert student.get('/api/materials/MAT_KHONG_CO').status_code == 404
    assert student.get('/api/materials/..%2Fstudent_profile').status_code == 404


def test_overview_counts_and_permissions(teacher: TestClient, student: TestClient) -> None:
    body = teacher.get('/api/overview').json()
    assert body['students'] == 34 and body['attempts'] == 51
    # Xếp loại theo bài gần nhất: mỗi học sinh đã làm bài đúng một lần, và Chưa đạt khớp với nhóm cần chú ý dưới 5 điểm
    assert sum(b['count'] for b in body['score_bands']) == body['submitted_students']
    weak = sum(a['attempt']['total_score'] < 5 for a in body['attention'])
    assert body['score_bands'][-1] == {'id': 'Chưa đạt', 'name': 'Chưa đạt', 'count': weak}
    assert [c['class_name'] for c in body['classes']] == ['9 - Nhóm 2']
    assert sum(e['attempts'] for e in body['exams']) == body['attempts']
    rates = [g['pass_rate'] for g in body['group_stats']]
    assert rates == sorted(rates)
    counts = [s['count'] for s in body['common_weak_skills']]
    assert counts == sorted(counts, reverse=True) and counts[0] <= body['submitted_students']
    assert all(a['attempt']['total_score'] < 5 or a['broad_weakness'] for a in body['attention'])

    one = teacher.get('/api/overview', params={'class_name': '9 - Nhóm 2'}).json()
    assert one['students'] == 34 and one['attempts'] == body['attempts']
    assert teacher.get('/api/overview', params={'class_name': 'không có'}).json()['students'] == 0
    assert student.get('/api/overview').status_code == 403


def test_overview_lists_top3_weak_points_skipped_for_missing_materials(data_dir: Path) -> None:
    # Dữ liệu thật: kho đủ học liệu, không điểm yếu Top 3 nào bị bỏ qua
    assert login(create_app(data_dir), 'teacher', 'gv.khoi9').get('/api/overview').json()['missing_materials'] == []

    # Xóa toàn bộ học liệu Giới từ: BR-REC-06 bỏ qua điểm yếu này, không lấy hạng 4 bù, giáo viên thấy trong tổng quan
    mat_csv = data_dir / 'Dữ liệu mẫu - material.csv'
    mats = pd.read_csv(mat_csv)
    removed = set(mats.loc[mats['skill_id'] == 'SK_PREPOSITION', 'material_id'])
    mats[~mats['material_id'].isin(removed)].to_csv(mat_csv, index=False)
    met = pd.read_csv(data_dir / 'material_error_type.csv')
    met[~met['material_id'].isin(removed)].to_csv(data_dir / 'material_error_type.csv', index=False)
    db_path(data_dir).unlink(missing_ok=True)

    body = login(create_app(data_dir), 'teacher', 'gv.khoi9').get('/api/overview').json()
    missing = {m['id']: m for m in body['missing_materials']}
    assert missing['SK_PREPOSITION']['name'] == 'Giới từ và cụm giới từ'
    assert 0 < missing['SK_PREPOSITION']['count'] <= body['submitted_students']
    # Mỗi mục là điểm yếu Top 3 không có dòng học liệu tương ứng; lượt đó vẫn tối đa 3 học liệu, không lấy bù
    skills = read_db(data_dir, 'diagnosis_skill')
    recs = read_db(data_dir, 'recommendation')
    skipped = skills[(skills['in_top_k'] == 1) & (skills['unit_id'] == 'SK_PREPOSITION')]
    assert not skipped.empty and recs.merge(skipped, on=['attempt_id', 'unit_id']).empty
    assert (recs.groupby('attempt_id').size() <= 3).all()
    assert recs[recs['attempt_id'].isin(skipped['attempt_id'])].groupby('attempt_id').size().max() <= 2


def test_overview_reads_diagnosis_tables_and_follows_new_attempts(
    app: FastAPI, teacher: TestClient, data_dir: Path
) -> None:
    before = teacher.get('/api/overview', params={'class_name': '9 - Nhóm 2'}).json()
    diagnosis = read_db(data_dir, 'diagnosis')
    assert len(diagnosis) == 51 and set(diagnosis['rules_version']) == {'v4'}

    # Nộp bài trắng: 0 điểm, học sinh STU00006 thành học sinh cần chú ý
    login(app, 'student', 'STU00006').post('/api/attempts', json={'exam_id': EXAM, 'answers': {}})
    after = teacher.get('/api/overview', params={'class_name': '9 - Nhóm 2'}).json()
    assert after['attempts'] == before['attempts'] + 1
    assert after['score_bands'][-1]['count'] == before['score_bands'][-1]['count'] + 1
    assert any(a['attempt']['student']['student_id'] == 'STU00006' for a in after['attention'])
    # Bài vừa nộp đã nằm trong CSDL: lượt làm, 40 kết quả từng câu, kết quả chẩn đoán, thông báo
    assert len(read_db(data_dir, 'diagnosis')) == 52
    new = read_db(data_dir, 'attempt').iloc[-1]
    assert (new['student_id'], new['source']) == ('STU00006', 'web')
    assert len(read_db(data_dir, 'result').query('attempt_id == @new.attempt_id')) == 40
    assert len(read_db(data_dir, 'notification')) == 1


def test_results_table_latest_per_student_or_by_exam(teacher: TestClient, student: TestClient) -> None:
    latest = teacher.get('/api/results').json()
    assert len(latest) == 34 and len({r['attempt']['student']['student_id'] for r in latest}) == 34
    scores = [r['attempt']['total_score'] for r in latest]
    assert scores == sorted(scores)
    by_exam = teacher.get('/api/results', params={'exam_id': EXAM}).json()
    assert by_exam and all(r['attempt']['exam']['exam_id'] == EXAM for r in by_exam)
    assert student.get('/api/results').status_code == 403


def test_answers_review_after_submit(app: FastAPI, student: TestClient, teacher: TestClient, data_dir: Path) -> None:
    key = answer_key(data_dir)
    first, second = list(key)[:2]
    answers: dict[str, str | None] = dict(key)
    answers[first] = 'A' if key[first] != 'A' else 'B'
    answers[second] = None
    resp = student.post('/api/attempts', json={'exam_id': EXAM, 'answers': answers})
    attempt_id = resp.json()['attempt']['attempt_id']

    review = student.get(f'/api/attempts/{attempt_id}/answers').json()
    assert [r['question']['question_no'] for r in review] == list(range(1, 41))
    wrong, blank, right = review[0], review[1], review[2]
    assert wrong['is_correct'] is False and wrong['selected_opt'] == answers[first]
    assert wrong['correct_opt'] == key[first]
    assert blank['selected_opt'] is None and blank['is_correct'] is False
    assert right['is_correct'] is True and right['explanation'] and right['skill_name']
    # Bài có sẵn trong dữ liệu mẫu cũng xem lại được; học sinh khác không xem được
    assert len(teacher.get(f'/api/attempts/{attempt_id}/answers').json()) == 40
    assert login(app, 'student', 'STU00001').get(f'/api/attempts/{attempt_id}/answers').status_code == 403


def test_sign_and_notice_questions_carry_media(student: TestClient) -> None:
    by_no = {q['question_no']: q for q in student.get('/api/exams/EXAM_G9_TT_125/questions').json()}
    sign, notice = by_no[30]['media'], by_no[29]['media']
    assert by_no[30]['question_text'] == 'What does the sign mean?'
    assert sign['kind'] == 'sign' and sign['src'] == '/api/media/signs/cam-coi.svg' and sign['alt']
    assert notice['kind'] == 'notice' and 'Super Weekly Saver Ticket' in notice['text']
    assert by_no[1]['media'] is None
    image = student.get(sign['src'])
    assert image.status_code == 200 and image.headers['content-type'].startswith('image/svg')
    assert student.get('/api/media/../question_media.csv').status_code == 404
    assert student.get('/api/media/%2E%2E/accounts.csv').status_code == 404


def test_pronunciation_questions_carry_underline(student: TestClient) -> None:
    questions = student.get('/api/exams/EXAM_G9_TT_125/questions').json()
    by_no = {q['question_no']: q for q in questions}
    q1 = by_no[1]
    # "[a]ccess", "p[a]radise": gạch chân đúng chữ "a"
    assert [q1['options'][o][a:b] for o, (a, b) in q1['underline'].items()] == ['a', 'a', 'a', 'a']
    assert q1['underline']['B'] == [1, 2]
    assert by_no[3]['underline'] is None  # câu trọng âm không gạch chân


def test_library_suggests_level_from_latest_attempt(student: TestClient) -> None:
    body = student.get('/api/materials').json()
    assert len(body['items']) == 125
    latest = next(a for a in student.get('/api/attempts').json() if a['diagnosed'])
    assert body['attempt_id'] == latest['attempt_id']
    dx = student.get(f'/api/attempts/{latest["attempt_id"]}/diagnosis').json()
    score = dx['total_score']
    assert body['suggested_level'] == (1 if score < 5 else 2 if score < 8 else 3)
    # Học liệu được đánh dấu đề xuất đúng bằng Top-K của lượt làm bài; phần yếu khớp chuyên đề bị chẩn đoán
    assert {i['material_id'] for i in body['items'] if i['recommended']} == {
        r['material_id'] for r in dx['recommendations']
    }
    weak_topics = {t for w in dx['weak_skills'] for t in w['member_topics']}
    assert {i['skill_id'] for i in body['items'] if i['weak']} <= weak_topics
    assert all(i['level'] in (1, 2, 3) for i in body['items'])


def test_library_permissions(teacher: TestClient, student: TestClient) -> None:
    # Giáo viên không gửi lượt làm bài: xem toàn bộ kho, không có mức gợi ý
    body = teacher.get('/api/materials').json()
    assert body['suggested_level'] is None and not any(i['recommended'] or i['weak'] for i in body['items'])
    other = next(a for a in teacher.get('/api/attempts').json() if a['student']['student_id'] != 'STU00006')
    assert student.get(f'/api/materials?attempt_id={other["attempt_id"]}').status_code == 403
    assert teacher.get(f'/api/materials?attempt_id={other["attempt_id"]}').json()['suggested_level'] in (1, 2, 3)


def test_suggested_level_thresholds() -> None:
    from engine import suggested_level

    assert [suggested_level(s) for s in (4.99, 5.0, 7.75, 8.0, 10.0)] == [1, 2, 2, 3, 3]
