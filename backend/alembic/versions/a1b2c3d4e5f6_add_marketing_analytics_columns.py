"""add marketing analytics columns

Revision ID: a1b2c3d4e5f6
Revises: eb3b65c74d5f
Create Date: 2026-04-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'eb3b65c74d5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Campaign info
    op.add_column('campaigns', sa.Column('campaign_objective', sa.String(length=100), nullable=True))
    op.add_column('campaigns', sa.Column('platform', sa.String(length=50), nullable=True))
    op.add_column('campaigns', sa.Column('ad_placement', sa.String(length=100), nullable=True))
    op.add_column('campaigns', sa.Column('industry_vertical', sa.String(length=100), nullable=True))
    op.add_column('campaigns', sa.Column('budget_tier', sa.String(length=50), nullable=True))

    # Device & OS
    op.add_column('campaigns', sa.Column('device_type', sa.String(length=50), nullable=True))
    op.add_column('campaigns', sa.Column('operating_system', sa.String(length=50), nullable=True))

    # Creative
    op.add_column('campaigns', sa.Column('creative_format', sa.String(length=50), nullable=True))
    op.add_column('campaigns', sa.Column('creative_size', sa.String(length=50), nullable=True))
    op.add_column('campaigns', sa.Column('ad_copy_length', sa.String(length=20), nullable=True))
    op.add_column('campaigns', sa.Column('has_call_to_action', sa.Boolean(), nullable=True))
    op.add_column('campaigns', sa.Column('creative_emotion', sa.String(length=50), nullable=True))
    op.add_column('campaigns', sa.Column('creative_age_days', sa.Integer(), nullable=True))

    # Targeting
    op.add_column('campaigns', sa.Column('target_audience_age', sa.String(length=20), nullable=True))
    op.add_column('campaigns', sa.Column('target_audience_gender', sa.String(length=20), nullable=True))
    op.add_column('campaigns', sa.Column('audience_interest_category', sa.String(length=100), nullable=True))
    op.add_column('campaigns', sa.Column('income_bracket', sa.String(length=50), nullable=True))
    op.add_column('campaigns', sa.Column('purchase_intent_score', sa.String(length=20), nullable=True))
    op.add_column('campaigns', sa.Column('retargeting_flag', sa.Boolean(), nullable=True))

    # Time
    op.add_column('campaigns', sa.Column('quarter', sa.Integer(), nullable=True))
    op.add_column('campaigns', sa.Column('day_of_week', sa.String(length=20), nullable=True))
    op.add_column('campaigns', sa.Column('hour_of_day', sa.Integer(), nullable=True))
    op.add_column('campaigns', sa.Column('campaign_day', sa.Integer(), nullable=True))

    # Quality & Performance
    op.add_column('campaigns', sa.Column('quality_score', sa.Integer(), nullable=True))
    op.add_column('campaigns', sa.Column('actual_cpc', sa.Float(), nullable=True))
    op.add_column('campaigns', sa.Column('revenue', sa.Float(), nullable=True))
    op.add_column('campaigns', sa.Column('conversions', sa.Integer(), nullable=True))

    # Engagement metrics
    op.add_column('campaigns', sa.Column('bounce_rate', sa.Float(), nullable=True))
    op.add_column('campaigns', sa.Column('avg_session_duration', sa.Float(), nullable=True))
    op.add_column('campaigns', sa.Column('pages_per_session', sa.Float(), nullable=True))

    # Calculated KPIs
    op.add_column('campaigns', sa.Column('ctr', sa.Float(), nullable=True))
    op.add_column('campaigns', sa.Column('cpc', sa.Float(), nullable=True))
    op.add_column('campaigns', sa.Column('conversion_rate', sa.Float(), nullable=True))
    op.add_column('campaigns', sa.Column('cpa', sa.Float(), nullable=True))
    op.add_column('campaigns', sa.Column('roas', sa.Float(), nullable=True))
    op.add_column('campaigns', sa.Column('profit', sa.Float(), nullable=True))

    # Index for common queries
    op.create_index('ix_campaigns_platform_objective', 'campaigns', ['platform', 'campaign_objective'])


def downgrade() -> None:
    op.drop_index('ix_campaigns_platform_objective', table_name='campaigns')

    op.drop_column('campaigns', 'profit')
    op.drop_column('campaigns', 'roas')
    op.drop_column('campaigns', 'cpa')
    op.drop_column('campaigns', 'conversion_rate')
    op.drop_column('campaigns', 'cpc')
    op.drop_column('campaigns', 'ctr')
    op.drop_column('campaigns', 'pages_per_session')
    op.drop_column('campaigns', 'avg_session_duration')
    op.drop_column('campaigns', 'bounce_rate')
    op.drop_column('campaigns', 'conversions')
    op.drop_column('campaigns', 'revenue')
    op.drop_column('campaigns', 'actual_cpc')
    op.drop_column('campaigns', 'quality_score')
    op.drop_column('campaigns', 'campaign_day')
    op.drop_column('campaigns', 'hour_of_day')
    op.drop_column('campaigns', 'day_of_week')
    op.drop_column('campaigns', 'quarter')
    op.drop_column('campaigns', 'retargeting_flag')
    op.drop_column('campaigns', 'purchase_intent_score')
    op.drop_column('campaigns', 'income_bracket')
    op.drop_column('campaigns', 'audience_interest_category')
    op.drop_column('campaigns', 'target_audience_gender')
    op.drop_column('campaigns', 'target_audience_age')
    op.drop_column('campaigns', 'creative_age_days')
    op.drop_column('campaigns', 'creative_emotion')
    op.drop_column('campaigns', 'has_call_to_action')
    op.drop_column('campaigns', 'ad_copy_length')
    op.drop_column('campaigns', 'creative_size')
    op.drop_column('campaigns', 'creative_format')
    op.drop_column('campaigns', 'operating_system')
    op.drop_column('campaigns', 'device_type')
    op.drop_column('campaigns', 'budget_tier')
    op.drop_column('campaigns', 'industry_vertical')
    op.drop_column('campaigns', 'ad_placement')
    op.drop_column('campaigns', 'platform')
    op.drop_column('campaigns', 'campaign_objective')
