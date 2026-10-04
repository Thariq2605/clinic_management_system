# doctorapp/migrations/0001_initial.py
#
# This migration is intentionally empty (no operations).
#
# Background:
#   An earlier version of the project (2026-09-10) placed all clinic models
#   inside doctorapp. The models were later refactored into the `core` app
#   (core/migrations/0001_initial.py, 2026-09-26). The doctorapp app now
#   has no models of its own (doctorapp/models.py is empty).
#
#   This empty migration exists so that the django_migrations table record
#   ('doctorapp', '0001_initial') remains valid and Django's migration graph
#   stays consistent. All actual table creation is handled by core/0001_initial.
#
#   DO NOT add operations here. Do NOT regenerate from models.
#   If doctorapp ever gains its own models, create a 0002 migration.

from django.db import migrations


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        # intentionally empty -- all models belong to core
    ]
