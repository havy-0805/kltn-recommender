-- Lược đồ CSDL data/kltn.sqlite: kho dữ liệu chính của hệ thống.
-- Bảng danh mục (student ... question_underline, account) nạp từ CSV bằng `uv run python init_db.py`;
-- attempt và result gồm lượt thu từ cơ sở (nạp từ CSV) và lượt nộp trên web (ghi trực tiếp khi học sinh nộp bài);
-- notification và 3 bảng kết quả chẩn đoán do hệ thống ghi.

-- Danh mục

CREATE TABLE student (
    student_id TEXT PRIMARY KEY,
    grade INTEGER NOT NULL,
    "group" TEXT NOT NULL
);

CREATE TABLE student_profile (
    student_id TEXT PRIMARY KEY REFERENCES student (student_id),
    full_name TEXT NOT NULL
);

CREATE TABLE account (
    username TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
    student_id TEXT REFERENCES student (student_id),
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE exam (
    exam_id TEXT PRIMARY KEY,
    exam_title TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    grade INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    total_questions INTEGER NOT NULL
);

CREATE TABLE skill (
    skill_id TEXT PRIMARY KEY,
    skill_name TEXT NOT NULL,
    category TEXT NOT NULL,
    group_id TEXT NOT NULL,
    group_name TEXT NOT NULL
);

CREATE TABLE error_type (
    error_type TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL REFERENCES skill (skill_id),
    error_name TEXT NOT NULL
);

CREATE TABLE question (
    question_id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES exam (exam_id),
    question_no INTEGER NOT NULL,
    skill_id TEXT NOT NULL REFERENCES skill (skill_id),
    question_text TEXT NOT NULL,
    opt_a TEXT NOT NULL,
    opt_b TEXT NOT NULL,
    opt_c TEXT NOT NULL,
    opt_d TEXT NOT NULL,
    correct_opt TEXT NOT NULL CHECK (correct_opt IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    difficulty INTEGER NOT NULL CHECK (difficulty IN (1, 2, 3)),
    error_type TEXT REFERENCES error_type (error_type),
    UNIQUE (exam_id, question_no)
);

CREATE TABLE material (
    material_id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL REFERENCES skill (skill_id),
    material_title TEXT NOT NULL,
    target_level INTEGER NOT NULL CHECK (target_level IN (1, 2, 3))
);

CREATE TABLE material_error_type (
    material_id TEXT NOT NULL REFERENCES material (material_id),
    error_type TEXT NOT NULL REFERENCES error_type (error_type),
    PRIMARY KEY (material_id, error_type)
);

CREATE TABLE passage (
    passage_id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES exam (exam_id),
    from_no INTEGER NOT NULL,
    to_no INTEGER NOT NULL,
    title TEXT NOT NULL,
    text TEXT
);

CREATE TABLE question_media (
    question_id TEXT PRIMARY KEY REFERENCES question (question_id),
    kind TEXT NOT NULL CHECK (kind IN ('sign', 'notice')),
    file TEXT,
    text TEXT,
    alt TEXT NOT NULL
);

-- Phần gạch chân của câu phát âm, ghi bằng ngoặc vuông, vd. "typh[oo]n"
CREATE TABLE question_underline (
    question_id TEXT PRIMARY KEY REFERENCES question (question_id),
    opt_a TEXT NOT NULL,
    opt_b TEXT NOT NULL,
    opt_c TEXT NOT NULL,
    opt_d TEXT NOT NULL
);

-- Bài làm

CREATE TABLE attempt (
    attempt_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES student (student_id),
    exam_id TEXT NOT NULL REFERENCES exam (exam_id),
    started_at TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    total_score REAL NOT NULL CHECK (total_score BETWEEN 0 AND 10),
    -- 'seed': lượt thu từ cơ sở (nạp từ CSV); 'web': lượt nộp trên web
    source TEXT NOT NULL CHECK (source IN ('seed', 'web')),
    -- Học sinh đã mở trang kết quả phân tích (lượt thu từ cơ sở coi như đã xem)
    analysis_viewed INTEGER NOT NULL DEFAULT 0 CHECK (analysis_viewed IN (0, 1))
);
CREATE INDEX idx_attempt_student ON attempt (student_id);

CREATE TABLE result (
    result_id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES attempt (attempt_id),
    question_id TEXT NOT NULL REFERENCES question (question_id),
    -- NULL: bỏ trống (tính là sai)
    selected_opt TEXT CHECK (selected_opt IN ('A', 'B', 'C', 'D')),
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    UNIQUE (attempt_id, question_id)
);

CREATE TABLE notification (
    notification_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    attempt_id TEXT NOT NULL REFERENCES attempt (attempt_id),
    weak_skill_count INTEGER NOT NULL,
    recommendation_count INTEGER NOT NULL
);

-- Kết quả chẩn đoán (thuật toán hiện hành, 3 học liệu như học sinh thấy). Ghi khi nộp bài;
-- tính lại toàn bộ mỗi lần khởi động máy chủ để luôn khớp với thuật toán và dữ liệu hiện tại.

CREATE TABLE diagnosis (
    attempt_id TEXT PRIMARY KEY REFERENCES attempt (attempt_id),
    rules_version TEXT NOT NULL,
    top_k INTEGER NOT NULL,
    status TEXT NOT NULL,
    broad_weakness INTEGER NOT NULL
);

-- unit_id là skill.skill_id khi scope = 'topic', là skill.group_id khi scope = 'group' (gộp chuyên đề chỉ có 1 câu)
CREATE TABLE diagnosis_skill (
    attempt_id TEXT NOT NULL REFERENCES attempt (attempt_id),
    priority_rank INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('topic', 'group')),
    gap_type TEXT NOT NULL,
    wrong_q INTEGER NOT NULL,
    total_q INTEGER NOT NULL,
    in_top_k INTEGER NOT NULL,
    PRIMARY KEY (attempt_id, priority_rank)
);

CREATE TABLE recommendation (
    attempt_id TEXT NOT NULL REFERENCES attempt (attempt_id),
    rank INTEGER NOT NULL,
    unit_id TEXT NOT NULL,
    material_id TEXT NOT NULL REFERENCES material (material_id),
    PRIMARY KEY (attempt_id, rank)
);
