from pathlib import Path
import secrets
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError
from catalog.staff_views import ensure_roles

class Command(BaseCommand):
    help = 'Create a staff account and save a generated password to a local file (never overwrites users).'
    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--role', choices=['administrator', 'editor'], default='administrator')
        parser.add_argument('--credentials-file', required=True)
    def handle(self, *args, **options):
        username = options['username']
        if get_user_model().objects.filter(username=username).exists():
            raise CommandError('User already exists. Use Django Admin to manage that account.')
        destination = Path(options['credentials_file']).resolve()
        if destination.exists():
            raise CommandError('Credential file already exists; choose a new path.')
        ensure_roles()
        password = secrets.token_urlsafe(24)
        user = get_user_model().objects.create_user(username=username, password=password, is_staff=True)
        user.groups.add(Group.objects.get(name='Veloura Administrators' if options['role'] == 'administrator' else 'Veloura Catalog Editors'))
        destination.write_text(f'Veloura staff dashboard\nURL: http://127.0.0.1:3000/admin/login\nUsername: {username}\nPassword: {password}\n\nKeep this local file private. Do not commit or share it.\n', encoding='utf-8')
        destination.chmod(0o600)
        self.stdout.write(self.style.SUCCESS(f'Staff account created. Credentials saved to {destination}'))
