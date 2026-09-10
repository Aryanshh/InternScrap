import datetime
from sqlalchemy import Column, String, DateTime
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(100), primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
