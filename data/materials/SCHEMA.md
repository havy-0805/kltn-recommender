# Định dạng nội dung học liệu

Mỗi học liệu là một file `data/materials/<material_id>.json`, mã hóa UTF-8, theo cấu trúc sau:

```json
{
  "material_id": "MAT_COMP_01",
  "skill_id": "SK_COMPARATIVE",
  "title": "Cấu trúc so sánh bằng, hơn và hơn nhất cơ bản",
  "target_level": 1,
  "summary": "1–2 câu tiếng Việt: học liệu này giúp học sinh làm được gì.",
  "theory": [
    {
      "heading": "So sánh hơn với tính từ ngắn",
      "points": ["S + be + adj-er + than + N/Pronoun", "Tính từ tận cùng -y: đổi y → i rồi thêm -er (happy → happier)"],
      "examples": [{ "en": "My house is bigger than yours.", "vi": "Nhà tôi to hơn nhà bạn." }]
    }
  ],
  "tips": ["Mẹo làm bài ngắn gọn, tiếng Việt"],
  "exercise_sets": [
    {
      "title": "Bài 1. Chọn đáp án đúng",
      "instructions": "Choose the best option (A, B, C or D) to complete each sentence.",
      "passage": null,
      "questions": [
        {
          "no": 1,
          "question": "This book is ______ than that one.",
          "options": { "A": "interesting", "B": "more interesting", "C": "most interesting", "D": "the most interesting" },
          "answer": "B",
          "explanation": "Tính từ dài 'interesting' → so sánh hơn dùng 'more + adj + than'."
        }
      ]
    }
  ],
  "references": [{ "title": "Tên nguồn đã tham khảo", "url": "https://..." }]
}
```

## Quy tắc

- `material_id`, `skill_id`, `title`, `target_level` lấy **đúng nguyên văn** từ `Dữ liệu mẫu - material.csv`.
- **Ngôn ngữ:** phần lý thuyết, mẹo và giải thích viết bằng tiếng Việt. Câu hỏi, phương án và đoạn văn viết bằng tiếng Anh, theo đúng dạng đề thi vào lớp 10 (Hà Nội).
- **Độ khó theo level:**
  - Level 1: nhận biết, kiến thức nền.
  - Level 2: thông hiểu, dạng đề phổ biến.
  - Level 3: vận dụng cao, câu bẫy, phân hóa điểm 9–10.
- `theory`: 2–5 mục. Mỗi mục có ít nhất 1 ví dụ song ngữ.
- `tips`: 2–5 mẹo làm bài.
- `exercise_sets`: 1–5 bộ, **tổng ít nhất 10 câu**. Số `no` liên tục 1..N trên toàn bộ học liệu.
  - Bài đọc (đọc hiểu, điền từ, gapped text, sắp xếp đoạn…): đặt đoạn văn vào `passage` (120–250 từ), các câu hỏi bên dưới dựa vào đoạn đó.
  - Ngữ âm: không gạch chân được, nên ghi phần cần xét bằng chữ in hoa hoặc trong ngoặc. Ví dụ: `"Choose the word whose underlined part is pronounced differently: (oo) in fOOd, gOOd, mOOn, spOOn"`.
- Mỗi câu có đúng 4 phương án A–D khác nhau và đúng 1 đáp án. `explanation` phải chỉ ra vì sao đáp án đúng.
- **Bản quyền:** tự soạn nội dung mới. Chỉ dùng nguồn web để đối chiếu quy tắc và dạng đề, không sao chép nguyên văn câu hỏi hoặc đoạn văn. Ghi các nguồn đã tham khảo vào `references`.
- Kiểm tra trước khi giao: `cd backend && uv run python validate_materials.py <material_id> ...`
