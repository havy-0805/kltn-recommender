-- Số liệu trang "Tổng quan lớp" (giáo viên). Mỗi khối "-- name: <tên>" là một câu lệnh;
-- backend chạy đúng các câu này trên CSDL data/kltn.sqlite (database.py), nên bài vừa nộp có ngay trong số liệu.
-- Chạy tay: sqlite3 data/kltn.sqlite rồi dán câu lệnh; thay :class_name bằng NULL (mọi lớp) hoặc '9 - Nhóm 2'.
--
-- Bảng dữ liệu: student, student_profile (họ tên hiển thị), exam, question, skill, material, attempt, result, notification.
-- Lớp = khối + nhóm của bảng student, vd. grade 9, group 'Nhom2' -> '9 - Nhóm 2' (hiển thị "Lớp 9 - Nhóm 2").
-- Bảng kết quả chẩn đoán (thuật toán hiện hành, top_k = 3 như học sinh thấy), lược đồ đầy đủ ở sql/schema.sql:
--   diagnosis(attempt_id, rules_version, top_k, status, broad_weakness)
--   diagnosis_skill(attempt_id, priority_rank, unit_id, scope, gap_type, wrong_q, total_q, in_top_k)
--   recommendation(attempt_id, rank, unit_id, material_id)
-- unit_id là skill.skill_id khi scope = 'topic', là skill.group_id khi scope = 'group' (gộp chuyên đề chỉ có 1 câu).

-- name: views
-- Học sinh kèm lớp; lượt làm bài kèm lớp; bài làm gần nhất của mỗi học sinh (để thống kê kỹ năng không đếm trùng).
CREATE VIEW IF NOT EXISTS v_student AS
SELECT student_id, grade, "group", grade || ' - Nhóm ' || REPLACE("group", 'Nhom', '') AS class_name
FROM student;

CREATE VIEW IF NOT EXISTS v_attempt AS
SELECT a.*, s.class_name
FROM attempt a
JOIN v_student s ON s.student_id = a.student_id;

CREATE VIEW IF NOT EXISTS v_latest_attempt AS
SELECT *
FROM (
    SELECT v.*, ROW_NUMBER() OVER (PARTITION BY v.student_id ORDER BY v.submitted_at DESC, v.attempt_id DESC) AS rn
    FROM v_attempt v
)
WHERE rn = 1;

CREATE VIEW IF NOT EXISTS v_unit AS
SELECT skill_id AS unit_id, 'topic' AS scope, skill_name AS unit_name FROM skill
UNION
SELECT DISTINCT group_id, 'group', group_name FROM skill;

-- name: totals
SELECT
    (SELECT COUNT(*)
     FROM v_student
     WHERE :class_name IS NULL OR class_name = :class_name) AS students,
    COUNT(DISTINCT student_id) AS submitted_students,
    COUNT(*) AS attempts,
    COUNT(DISTINCT exam_id) AS exams_taken,
    ROUND(AVG(total_score), 2) AS average_score,
    AVG(total_score >= 5) AS pass_rate
FROM v_attempt
WHERE :class_name IS NULL OR class_name = :class_name;

-- name: score_bands
-- Xếp loại theo điểm bài làm gần nhất của mỗi học sinh (đơn vị là học sinh, cùng với "Học sinh cần chú ý").
-- 4 mức như Thông tư 22/2021: 9 – 10 Tốt, 7 – 8.9 Khá, 5 – 6.9 Đạt, dưới 5 Chưa đạt; giống gradeBand ở frontend.
WITH band(name, ord) AS (
    VALUES ('Tốt', 1), ('Khá', 2), ('Đạt', 3), ('Chưa đạt', 4)
),
scored AS (
    SELECT CASE
        WHEN total_score >= 9 THEN 'Tốt'
        WHEN total_score >= 7 THEN 'Khá'
        WHEN total_score >= 5 THEN 'Đạt'
        ELSE 'Chưa đạt'
    END AS band
    FROM v_latest_attempt
    WHERE :class_name IS NULL OR class_name = :class_name
)
SELECT b.name AS id, b.name AS name, COUNT(s.band) AS count
FROM band b
LEFT JOIN scored s ON s.band = b.name
GROUP BY b.name, b.ord
ORDER BY b.ord;

-- name: classes
SELECT
    s.class_name,
    COUNT(DISTINCT s.student_id) AS students,
    COUNT(DISTINCT a.student_id) AS submitted_students,
    ROUND(AVG(a.total_score), 2) AS average_score
FROM v_student s
LEFT JOIN attempt a ON a.student_id = s.student_id
WHERE :class_name IS NULL OR s.class_name = :class_name
GROUP BY s.class_name
ORDER BY s.class_name;

-- name: exams
SELECT
    e.exam_id,
    e.exam_title,
    COUNT(*) AS attempts,
    COUNT(DISTINCT v.student_id) AS students,
    ROUND(AVG(v.total_score), 2) AS average_score,
    AVG(v.total_score >= 5) AS pass_rate
FROM v_attempt v
JOIN exam e ON e.exam_id = v.exam_id
WHERE :class_name IS NULL OR v.class_name = :class_name
GROUP BY e.exam_id, e.exam_title
ORDER BY e.exam_id;

-- name: group_stats
-- Tỷ lệ đạt theo nhóm kiến thức: cộng số câu đúng / số câu của bài làm gần nhất mỗi học sinh.
SELECT
    k.group_id AS id,
    k.group_name AS name,
    SUM(r.is_correct) AS correct_q,
    COUNT(*) AS total_q,
    1.0 * SUM(r.is_correct) / COUNT(*) AS pass_rate
FROM v_latest_attempt la
JOIN result r ON r.attempt_id = la.attempt_id
JOIN question q ON q.question_id = r.question_id
JOIN skill k ON k.skill_id = q.skill_id
WHERE :class_name IS NULL OR la.class_name = :class_name
GROUP BY k.group_id, k.group_name
ORDER BY pass_rate, name;

-- name: common_weak_skills
SELECT u.unit_id AS id, u.unit_name AS name, COUNT(DISTINCT la.student_id) AS count
FROM v_latest_attempt la
JOIN diagnosis_skill d ON d.attempt_id = la.attempt_id
JOIN v_unit u ON u.unit_id = d.unit_id AND u.scope = d.scope
WHERE :class_name IS NULL OR la.class_name = :class_name
GROUP BY u.unit_id, u.unit_name
ORDER BY count DESC, name
LIMIT 8;

-- name: top_materials
SELECT m.material_id AS id, m.material_title AS name, COUNT(DISTINCT la.student_id) AS count
FROM v_latest_attempt la
JOIN recommendation rc ON rc.attempt_id = la.attempt_id
JOIN material m ON m.material_id = rc.material_id
WHERE :class_name IS NULL OR la.class_name = :class_name
GROUP BY m.material_id, m.material_title
ORDER BY count DESC, name
LIMIT 5;

-- name: missing_materials
-- Điểm yếu nằm trong Top 3 nhưng không nhận được học liệu (BR-REC-06 bỏ qua, không lấy điểm yếu hạng 4 bù):
-- kho không có học liệu của chuyên đề, hoặc học sinh từ 8 điểm mà chuyên đề chỉ có học liệu Level 1.
-- Giáo viên dùng danh sách này để biết cần bổ sung học liệu cho chuyên đề nào.
SELECT u.unit_id AS id, u.unit_name AS name, COUNT(DISTINCT la.student_id) AS count
FROM v_latest_attempt la
JOIN diagnosis_skill d ON d.attempt_id = la.attempt_id AND d.in_top_k = 1
JOIN v_unit u ON u.unit_id = d.unit_id AND u.scope = d.scope
WHERE (:class_name IS NULL OR la.class_name = :class_name)
  AND NOT EXISTS (
      SELECT 1 FROM recommendation rc WHERE rc.attempt_id = d.attempt_id AND rc.unit_id = d.unit_id
  )
GROUP BY u.unit_id, u.unit_name
ORDER BY count DESC, name;

-- name: attention
-- Học sinh cần chú ý: bài làm gần nhất dưới 5 điểm hoặc bị chẩn đoán mất gốc diện rộng.
SELECT
    la.attempt_id,
    (SELECT COUNT(*) FROM diagnosis_skill d WHERE d.attempt_id = la.attempt_id) AS weak_skill_count,
    dg.broad_weakness
FROM v_latest_attempt la
JOIN diagnosis dg ON dg.attempt_id = la.attempt_id
WHERE (:class_name IS NULL OR la.class_name = :class_name)
  AND (la.total_score < 5 OR dg.broad_weakness = 1)
ORDER BY la.total_score, la.attempt_id;

-- name: results
-- Bảng kết quả học sinh (trang "Kết quả học sinh"): không chọn đề thì lấy bài gần nhất của mỗi học sinh,
-- chọn đề (:exam_id) thì lấy mọi lượt làm đề đó. Điểm thấp xếp trước.
SELECT
    v.attempt_id,
    (SELECT COUNT(*) FROM diagnosis_skill d WHERE d.attempt_id = v.attempt_id) AS weak_skill_count,
    dg.broad_weakness
FROM v_attempt v
JOIN diagnosis dg ON dg.attempt_id = v.attempt_id
WHERE (:class_name IS NULL OR v.class_name = :class_name)
  AND (
      (:exam_id IS NULL AND v.attempt_id IN (SELECT attempt_id FROM v_latest_attempt))
      OR v.exam_id = :exam_id
  )
ORDER BY v.total_score, v.attempt_id;
