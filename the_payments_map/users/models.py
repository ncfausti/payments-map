from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import CharField
from django.urls import reverse
from django.utils.translation import ugettext_lazy as _


class User(AbstractUser):

    # First Name and Last Name do not cover name patterns
    # around the globe.
    name = CharField(_("Name of User"), blank=True, max_length=255)

    def get_absolute_url(self):
        return reverse("users:detail", kwargs={"username": self.username})

class Marker(models.Model):
    lat = models.CharField(max_length=32)
    lng = models.CharField(max_length=32)
    comment = models.CharField(max_length=255)
    marker_id = models.CharField(max_length=255)
    stripe_pid = models.CharField(max_length=255)
    pub_date = models.DateTimeField('date published')