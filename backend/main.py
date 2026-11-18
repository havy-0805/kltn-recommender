"""API cho hệ thống khuyến nghị học liệu. Chạy: uv run uvicorn main:app --reload"""

import os
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from auth import COOKIE_NAME, SESSION_SECONDS, Accounts, User
from database import DEFAULT_DATA_DIR
from schemas import (
    AnswerReview,
    Attempt,
    AttemptSummary,
    Diagnosis,
    Exam,
    Library,
    LoginRequest,
    MaterialContent,
    Me,
    Notification,
    Overview,
    Question,
    Student,
    SubmitRequest,
    SubmitResponse,
)
from store import Store

WS_UNAUTHORIZED = 4401


class TeacherChannel:
    """Đẩy thông báo real-time tới mọi tab giáo viên đang mở."""

    def __init__(self) -> None:
        self.sockets: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.sockets.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.sockets.discard(ws)

    async def broadcast(self, notification: Notification) -> None:
        payload = {'type': 'notification', 'data': notification.model_dump(mode='json')}
        for ws in list(self.sockets):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(ws)


def create_app(data_dir: Path = DEFAULT_DATA_DIR) -> FastAPI:
    store = Store(data_dir)
    accounts = Accounts(data_dir, store.con)
    channel = TeacherChannel()
    app = FastAPI(title='Trung tâm Tri Thức API')
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:5173').split(','),
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    @app.exception_handler(KeyError)
    async def not_found(_: Request, err: KeyError) -> JSONResponse:
        return JSONResponse(status_code=404, content={'detail': err.args[0]})

    # Phân quyền

    def current_user(request: Request) -> User:
        user = accounts.resolve(request.cookies.get(COOKIE_NAME))
        if user is None:
            raise HTTPException(status_code=401, detail='Bạn chưa đăng nhập hoặc phiên đã hết hạn')
        return user

    CurrentUser = Annotated[User, Depends(current_user)]

    def teacher_only(user: CurrentUser) -> User:
        if user.role != 'teacher':
            raise HTTPException(status_code=403, detail='Chỉ giáo viên được dùng chức năng này')
        return user

    Teacher = Annotated[User, Depends(teacher_only)]

    def student_only(user: CurrentUser) -> str:
        if user.role != 'student' or user.student_id is None:
            raise HTTPException(status_code=403, detail='Chỉ học sinh được dùng chức năng này')
        return user.student_id

    StudentId = Annotated[str, Depends(student_only)]

    def ensure_can_view(user: User, student_id: str) -> None:
        if user.role != 'teacher' and user.student_id != student_id:
            raise HTTPException(status_code=403, detail='Bạn không có quyền xem dữ liệu của học sinh khác')

    def visible_attempt(user: User, attempt_id: str) -> Attempt:
        attempt = store.attempt(attempt_id)
        ensure_can_view(user, attempt.student.student_id)
        return attempt

    def me(user: User) -> Me:
        student = store.student(user.student_id) if user.student_id else None
        return Me(username=user.username, role=user.role, display_name=user.display_name, student=student)

    # Đăng nhập

    @app.post('/api/auth/login')
    async def login(req: LoginRequest, response: Response) -> Me:
        user = accounts.authenticate(req.role, req.username, req.password)
        if user is None:
            raise HTTPException(status_code=401, detail='Sai tên đăng nhập hoặc mật khẩu')
        response.set_cookie(
            COOKIE_NAME,
            accounts.issue(user),
            max_age=SESSION_SECONDS,
            httponly=True,
            samesite='lax',
            secure=os.environ.get('COOKIE_SECURE') == '1',
        )
        return me(user)

    @app.post('/api/auth/logout', status_code=204)
    async def logout(response: Response) -> None:
        response.delete_cookie(COOKIE_NAME)

    @app.get('/api/auth/me')
    async def get_me(request: Request) -> Me | None:
        """Chưa đăng nhập là trạng thái bình thường của trang đầu, nên trả null thay vì 401."""
        user = accounts.resolve(request.cookies.get(COOKIE_NAME))
        return me(user) if user else None

    # Danh mục

    @app.get('/api/classes')
    async def list_classes(_: Teacher) -> list[str]:
        return store.classes()

    @app.get('/api/overview')
    async def get_overview(_: Teacher, class_name: str | None = None) -> Overview:
        return store.overview(class_name)

    @app.get('/api/results')
    async def list_results(
        _: Teacher, class_name: str | None = None, exam_id: str | None = None
    ) -> list[AttemptSummary]:
        return store.results(class_name, exam_id)

    @app.get('/api/students')
    async def list_students(_: Teacher, class_name: str | None = None) -> list[Student]:
        return store.students(class_name)

    @app.get('/api/students/{student_id}')
    async def get_student(student_id: str, user: CurrentUser) -> Student:
        ensure_can_view(user, student_id)
        return store.student(student_id)

    @app.get('/api/exams')
    async def list_exams(_: CurrentUser) -> list[Exam]:
        return store.exams()

    @app.get('/api/exams/{exam_id}')
    async def get_exam(exam_id: str, _: CurrentUser) -> Exam:
        return store.exam(exam_id)

    @app.get('/api/exams/{exam_id}/questions')
    async def list_questions(exam_id: str, _: CurrentUser) -> list[Question]:
        return store.questions(exam_id)

    # Lượt làm bài và chẩn đoán

    @app.get('/api/attempts')
    async def list_attempts(
        user: CurrentUser, student_id: str | None = None, class_name: str | None = None
    ) -> list[Attempt]:
        if user.role == 'student':
            # Học sinh luôn chỉ thấy lượt làm của mình, bất kể tham số gửi lên
            if student_id not in (None, user.student_id):
                raise HTTPException(status_code=403, detail='Bạn không có quyền xem dữ liệu của học sinh khác')
            return store.attempts(user.student_id)
        return store.attempts(student_id, class_name)

    @app.post('/api/attempts', status_code=201)
    async def submit_attempt(req: SubmitRequest, student_id: StudentId) -> SubmitResponse:
        try:
            attempt, notification = store.submit(req, student_id)
        except ValueError as err:
            raise HTTPException(status_code=422, detail=str(err)) from err
        await channel.broadcast(notification)
        return SubmitResponse(attempt=attempt, notification=notification)

    @app.get('/api/attempts/{attempt_id}')
    async def get_attempt(attempt_id: str, user: CurrentUser) -> Attempt:
        return visible_attempt(user, attempt_id)

    @app.get('/api/attempts/{attempt_id}/answers')
    async def get_answers(attempt_id: str, user: CurrentUser) -> list[AnswerReview]:
        visible_attempt(user, attempt_id)
        return store.answers(attempt_id)

    @app.get('/api/attempts/{attempt_id}/diagnosis')
    async def get_diagnosis(
        attempt_id: str,
        user: CurrentUser,
        top_k: int = Query(3, ge=1, le=10),
    ) -> Diagnosis:
        visible_attempt(user, attempt_id)
        return store.diagnosis(attempt_id, top_k)

    @app.post('/api/attempts/{attempt_id}/diagnosis')
    async def run_diagnosis(attempt_id: str, user: CurrentUser, top_k: int = Query(3, ge=1, le=10)) -> Diagnosis:
        """Học sinh bấm "Phân tích": đánh dấu lượt làm của chính mình đã được chẩn đoán."""
        attempt = visible_attempt(user, attempt_id)
        if user.student_id != attempt.student.student_id:
            raise HTTPException(status_code=403, detail='Chỉ học sinh làm bài được chạy chẩn đoán lần đầu')
        store.mark_diagnosed(attempt_id)
        return store.diagnosis(attempt_id, top_k)

    @app.get('/api/media/{path:path}')
    async def get_media(path: str, _: CurrentUser) -> FileResponse:
        root = store.media_dir.resolve()
        file = (root / path).resolve()
        if not file.is_relative_to(root) or file.suffix not in {'.svg', '.png', '.jpg'} or not file.is_file():
            raise HTTPException(status_code=404, detail='Không tìm thấy ảnh')
        return FileResponse(file)

    @app.get('/api/materials')
    async def get_library(user: CurrentUser, attempt_id: str | None = None) -> Library:
        """Kho học liệu. Học sinh không gửi attempt_id thì lấy lượt đã xem kết quả gần nhất của mình."""
        if attempt_id is not None:
            visible_attempt(user, attempt_id)
        elif user.student_id is not None:
            attempt_id = store.latest_viewed_attempt(user.student_id)
        return store.library(attempt_id)

    @app.get('/api/materials/{material_id}')
    async def get_material(material_id: str, _: CurrentUser) -> MaterialContent:
        return store.material(material_id)

    # Thông báo cho giáo viên

    @app.get('/api/notifications')
    async def list_notifications(_: Teacher) -> list[Notification]:
        return store.notifications()

    @app.post('/api/notifications/read-all', status_code=204)
    async def read_all_notifications(_: Teacher) -> None:
        store.mark_read()

    @app.post('/api/notifications/{notification_id}/read', status_code=204)
    async def read_notification(notification_id: str, _: Teacher) -> None:
        store.mark_read(notification_id)

    @app.websocket('/ws/teacher')
    async def teacher_socket(ws: WebSocket) -> None:
        user = accounts.resolve(ws.cookies.get(COOKIE_NAME))
        if user is None or user.role != 'teacher':
            await ws.close(code=WS_UNAUTHORIZED)
            return
        await channel.connect(ws)
        try:
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            channel.disconnect(ws)

    return app


app = create_app(Path(os.environ.get('DATA_DIR', DEFAULT_DATA_DIR)))
