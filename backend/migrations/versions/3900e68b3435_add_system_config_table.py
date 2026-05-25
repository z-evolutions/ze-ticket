"""add system_config table

Revision ID: 3900e68b3435
Revises: 80c3c723db29
Create Date: 2026-05-23 19:58:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '3900e68b3435'
down_revision: Union[str, None] = '80c3c723db29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('system_config',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('description', sa.String(length=300), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_system_config_key'), 'system_config', ['key'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_system_config_key'), table_name='system_config')
    op.drop_table('system_config')
