/* Project specific Javascript goes here. */
window.mymap = null;

function onMapClick(e, comment) {
    const lat = e.latlng['lat'];
    const lng = e.latlng['lng'];
    $("#clickedLat").val(lat);
    $("#clickedLng").val(lng);
    $('#placemarker-modal').modal('show');
}

window.addEventListener("DOMContentLoaded", (event) => {

    // A reference to Stripe.js initialized with your real test publishable API key.
    var stripe = Stripe("pk_test_XdG3McysWHtpy2pBJMqrqdnQ00zSp5cDhh");
    // The items the customer wants to buy
    var purchase = {
        items: [{ id: "standard-marker" }]
    };

    // Disable the button until we have Stripe set up on the page
    document.querySelector("button").disabled = true;
    var csrftoken = jQuery("[name=csrfmiddlewaretoken]").val();
    fetch("/create-payment-intent", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken
        },
        body: JSON.stringify(purchase)
    })
        .then(function (result) {
            return result.json();
        })
        .then(function (data) {
            var elements = stripe.elements();
            var style = {
                base: {
                    color: "#32325d",
                    fontFamily: 'Arial, sans-serif',
                    fontSmoothing: "antialiased",
                    fontSize: "16px",
                    "::placeholder": {
                        color: "#32325d"
                    }
                },
                invalid: {
                    fontFamily: 'Arial, sans-serif',
                    color: "#fa755a",
                    iconColor: "#fa755a"
                }
            };
            var card = elements.create("card", { style: style });
            // Stripe injects an iframe into the DOM
            card.mount("#card-element");
            card.on("change", function (event) {
                // Disable the Pay button if there are no card details in the Element
                document.querySelector("button").disabled = event.empty;
                document.querySelector("#card-errors").textContent = event.error ? event.error.message : "";
            });
            var form = document.getElementById("payment-form");
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                // Complete payment when the submit button is clicked
                payWithCard(stripe, card, data.clientSecret);
            });
        });
        
    // Calls stripe.confirmCardPayment
    // If the card requires authentication Stripe shows a pop-up modal to
    // prompt the user to enter authentication details without leaving your page.
    var payWithCard = function (stripe, card, clientSecret) {
        loading(true);
        stripe
            .confirmCardPayment(clientSecret, {
                payment_method: {
                    card: card
                }
            })
            .then(function (result) {
                if (result.error) {
                    // Show error to your customer
                    showError(result.error.message);
                } else {
                    // The payment succeeded!
                    const lat = $("#clickedLat").val();
                    const lng = $("#clickedLng").val();
                    var markerComment = $("#commentInput").val();
                    const uid_str = result.paymentIntent.id.substring(
                        result.paymentIntent.id.length, 
                        result.paymentIntent.id.length-8);

                    $("#marker-uid").val(uid_str);

                    fetch("/confirm-payment", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            "pid": result.paymentIntent.id,
                            "lat": lat,
                            "lng": lng,
                            "marker_comment": markerComment,
                        })
                    }).then(function (result) {
                        if (result.status == 200) {
                            const lat = $("#clickedLat").val();
                            const lng = $("#clickedLng").val();
                            var markerComment = $("#commentInput").val();
                            const uid = $("#marker-uid").val();

                            // display
                            $('#placemarker-modal').on('hidden.bs.modal', function () {
                                addMarker(lat, lng, markerComment, uid, window.mymap);
                            });

                            $('#placemarker-modal').modal('hide');


                        }
                    });
                    orderComplete(result.paymentIntent.id);
                }
            });
    };

    /* ------- UI helpers ------- */
    // Shows a success message when the payment is complete
    var orderComplete = function (paymentIntentId) {
        loading(false);


        document
            .querySelector(".result-message a")
            .setAttribute(
                "href",
                "https://dashboard.stripe.com/test/payments/" + paymentIntentId
            );
        document.querySelector(".result-message").classList.remove("hidden");
        document.querySelector("button").disabled = true;
    };

    // Show the customer the error from Stripe if their card fails to charge
    var showError = function (errorMsgText) {
        loading(false);
        var errorMsg = document.querySelector("#card-errors");
        errorMsg.textContent = errorMsgText;
        setTimeout(function () {
            errorMsg.textContent = "";
        }, 4000);
    };

    // Show a spinner on payment submission
    var loading = function (isLoading) {
        if (isLoading) {
            // Disable the button and show a spinner
            document.querySelector("button").disabled = true;
            document.querySelector("#spinner").classList.remove("hidden");
            document.querySelector("#button-text").classList.add("hidden");
        } else {
            document.querySelector("button").disabled = false;
            document.querySelector("#spinner").classList.add("hidden");
            document.querySelector("#button-text").classList.remove("hidden");
        }
    };

    window.mymap = L.map('map', {scrollWheelZoom: false}).setView([37.0000, -98.0000], 4);

    // Add tile layer
    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoibmNmYXVzdGkiLCJhIjoiY2ozb2M2bnU0MDA1NTJxbjQzOGZob2thYyJ9.Xkb98mlUAX218AuCyfUdiA'
    }).addTo(window.mymap);


    window.mymap.on('click', onMapClick);

    markers.forEach(item => addMarker(
        item.fields.lat, 
        item.fields.lng, 
        item.fields.comment, 
        item.fields.stripe_confirm, 
        window.mymap));


});

function addMarker(lat, lng, comment, uid, map) {
    var iconOptions = {
        iconUrl: {% static "/static/images/marker.png" %},
        iconSize: [50, 50]
    };

    var customIcon = L.icon(iconOptions);
    var markerOptions = {
        icon: customIcon
    };

    const marker = L.marker([lat, lng], markerOptions).bindPopup(comment).addTo(map);

    if (getUrlParameter('uid') == uid || $("#marker-uid").val()) {
        marker.bindPopup(`${comment}`).openPopup();
    }

    return marker;
}


function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
    }
};
