"""
Management command: python manage.py seed_demo

Creates:
  - 1 reviewer account  (reviewer / reviewer123)
  - 3 merchant accounts (merchant1/2/3 / password123)
  - Submissions in various states for demo purposes
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

from kyc.models import UserProfile, KYCSubmission, KYCState


class Command(BaseCommand):
    help = 'Seed demo data for Playto KYC'

    def handle(self, *args, **options):
        self.stdout.write('Seeding demo data...')

        # Reviewer
        reviewer, _ = User.objects.get_or_create(
            username='reviewer',
            defaults={'email': 'reviewer@playto.in'}
        )
        reviewer.set_password('reviewer123')
        reviewer.save()
        profile, _ = UserProfile.objects.get_or_create(user=reviewer)
        profile.role = 'reviewer'
        profile.save()

        # Merchants
        merchants = []
        merchant_data = [
            ('merchant1', 'Priya Sharma', 'priya@agency.in', '+91 98765 43210', 'Digital Spark Agency', 'private_limited', 15000),
            ('merchant2', 'Arjun Mehta', 'arjun@freelance.in', '+91 87654 32109', 'Arjun Mehta Design', 'freelancer', 3500),
            ('merchant3', 'Kavya Nair', 'kavya@studio.in', '+91 76543 21098', 'Nair Creative Studio', 'sole_proprietorship', 8000),
        ]

        for username, name, email, phone, biz, biz_type, volume in merchant_data:
            user, _ = User.objects.get_or_create(username=username, defaults={'email': email})
            user.set_password('password123')
            user.save()
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = 'merchant'
            profile.save()
            merchants.append((user, name, email, phone, biz, biz_type, volume))

        # Create submissions in different states
        states_to_create = [
            (merchants[0], KYCState.DRAFT),          
            (merchants[1], KYCState.UNDER_REVIEW),    
            (merchants[2], KYCState.APPROVED),        
        ]

        for (user, name, email, phone, biz, biz_type, volume), target_state in states_to_create:
            # Skip if already exists
            if KYCSubmission.objects.filter(merchant=user).exists():
                continue

            sub = KYCSubmission.objects.create(
                merchant=user,
                full_name=name,
                email=email,
                phone=phone,
                business_name=biz,
                business_type=biz_type,
                expected_monthly_volume_usd=volume,
                state=KYCState.DRAFT,
            )

            if target_state in (KYCState.SUBMITTED, KYCState.UNDER_REVIEW, KYCState.APPROVED):
                sub.state = KYCState.SUBMITTED
                sub.submitted_at = timezone.now() - timedelta(hours=30)  # make some at-risk
                sub.save()

            if target_state in (KYCState.UNDER_REVIEW, KYCState.APPROVED):
                sub.state = KYCState.UNDER_REVIEW
                sub.reviewer = reviewer
                sub.save()

            if target_state == KYCState.APPROVED:
                sub.state = KYCState.APPROVED
                sub.reviewer = reviewer
                sub.reviewer_note = 'All documents verified. Business looks legitimate.'
                sub.reviewed_at = timezone.now()
                sub.save()

        self.stdout.write(self.style.SUCCESS(
            '\n✅ Demo data created!\n'
            '   Reviewer:  reviewer / reviewer123\n'
            '   Merchants: merchant1, merchant2, merchant3 / password123\n'
        ))
