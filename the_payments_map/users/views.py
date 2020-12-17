from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse
from django.utils.translation import ugettext_lazy as _
from django.views.generic import DetailView, RedirectView, UpdateView, TemplateView
from django.core import serializers
from payments_map.users.models import Marker
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django import forms
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

import json
from django.utils import timezone
import stripe

stripe.api_key = "sk_test_51GjTvnJ15mIDECgvS9wswmXUySDxrJbxa8pIHK5pycfNYFrDaWtxTctRxwYWsEeLIYYJXLNkfj3F9PKs5COmOGAJ00iYA3j51N"


User = get_user_model()
def calculate_order_amount(items):
    # Replace this constant with a calculation of the order's amount
    # Calculate the order total on the server to prevent
    # people from directly manipulating the amount on the client
    return 100


class HomeView(TemplateView):
    template_name = "pages/home.html"
    def get_context_data(self, *args, **kwargs):
        context = super(HomeView, self).get_context_data(*args, **kwargs)
        json_serializer = serializers.get_serializer("json")()
        markers = json_serializer.serialize(Marker.objects.all(), ensure_ascii=False)
        context['markers'] = markers
        return context


def create_payment(request):
    try:
        intent = stripe.PaymentIntent.create(
            amount=calculate_order_amount(request.POST.get('items')),
            currency='usd',
            metadata={'integration_check': 'accept_a_payment'}
        )
        return JsonResponse({
            'clientSecret': intent['client_secret']
        })
    except Exception as e:
        response = JsonResponse({"error":"error encountered"})
        response.status_code = 403
        return response


@csrf_exempt
def confirm_payment_success(request):
    payload = request.body
    try:
        marker_info = json.loads(payload)
        payment_intent_id = marker_info['pid']

        intent = stripe.PaymentIntent.retrieve(
            payment_intent_id,
        )
        
        # Parse results from Stripe API - https://stripe.com/docs/api/payment_intents/retrieve
        if intent.status == "succeeded":
            # and other info about order is correct
            # add marker here finally
            print("stripe says ok to add marker now")
            marker_info_lat = str(marker_info['lat'])
            marker_info_lng = str(marker_info['lng'])
            marker_comment = str(marker_info['marker_comment'])

            try:
                if len(marker_comment) > 255:
                    marker_comment = marker_comment[:255]
            except Exception as e:
                marker_comment = "--"
            
            if marker_comment == "":
                marker_comment = "--"

            uid = str(payment_intent_id[-8:])
            m = Marker(lat=marker_info_lat, lng=marker_info_lng, comment=marker_comment, marker_id=uid, stripe_pid=payment_intent_id, pub_date=timezone.now()) 
            m.save()
        else:
            print(intent.status)
            response.status_code = 403
            return response
        return JsonResponse({
            "status": intent.status, 
            "uid": str(uid),
            })

    except Exception as e:
        response = JsonResponse({"error":e})
        response.status_code = 403
        return response


# Using Django, this gets sent automatically after status changes 
# on Stripe's servers. I can do additional work here.
@csrf_exempt
def payment_success_check(request):
  payload = request.body
  event = None

  try:
    event = stripe.Event.construct_from(
      json.loads(payload), stripe.api_key
    )
  except ValueError as e:
    # Invalid payload
    return HttpResponse(status=400)

  # Handle the event
  if event.type == 'payment_intent.succeeded':
    payment_intent = event.data.object # contains a stripe.PaymentIntent
  elif event.type == 'payment_method.attached':
    payment_method = event.data.object # contains a stripe.PaymentMethod
  # ... handle other event types
  else:
    # Unexpected event type
    return HttpResponse(status=400)

  return HttpResponse(status=200)


class UserDetailView(LoginRequiredMixin, DetailView):

    model = User
    slug_field = "username"
    slug_url_kwarg = "username"


user_detail_view = UserDetailView.as_view()


class UserUpdateView(LoginRequiredMixin, UpdateView):

    model = User
    fields = ["name"]

    def get_success_url(self):
        return reverse("users:detail", kwargs={"username": self.request.user.username})

    def get_object(self):
        return User.objects.get(username=self.request.user.username)

    def form_valid(self, form):
        messages.add_message(
            self.request, messages.INFO, _("Infos successfully updated")
        )
        return super().form_valid(form)


user_update_view = UserUpdateView.as_view()


class UserRedirectView(LoginRequiredMixin, RedirectView):

    permanent = False

    def get_redirect_url(self):
        return reverse("users:detail", kwargs={"username": self.request.user.username})


user_redirect_view = UserRedirectView.as_view()
