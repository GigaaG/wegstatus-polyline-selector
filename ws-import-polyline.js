// ==UserScript==
// @name         Wegstatus Get Start / End From Polyline
// @namespace    http://wegstatus.nl/
// @version      0.0.2
// @description  Adds a button to the Wegstatus Reportal to get the start and end location from the polyline.
// @author       Sjors "GigaaG" Luyckx
// @match        https://www.wegstatus.nl/*
// @grant        GM_getValue
// @grant        GM_setValue

// ==/UserScript==

// De matchurl die niet werkt: /^https\:\/\/www.wegstatus.nl\/(reportal|roadworknl)\/
(function() {
    console.log('Start Polyline Script');

    // Message on first use
    var updateAlert = GM_getValue ("updateAlert",  "0.0.1");

if (updateAlert != "0.0.2") {
    GM_setValue ("updateAlert", "0.0.2");
    alert ("Let bij het selecteren van segmenten op! Zorg dat je van A -> B segmenten selecteert en controleer deze voor het opslaan!");
}

    // Get the polyline element
    var polylineElement = document.getElementsByClassName('col-xs-10')[2]

    // Create and add button
    var button = document.createElement('button');
    button.innerText = 'Get start and end points';
    button.classList.add("btn", "btn-default");
    button.setAttribute("id", "seButton");
    button.onclick = getCoordinates;
    polylineElement.appendChild(button);

    function getCoordinates(){
        // Get polyline from input box
        var polyline = $('#polyline').val();
        var coordinates = polyline.split(' ');
        var lastCoordinate = coordinates.length;

        // Chech if there is an Pol
        if (lastCoordinate >= 4){
            var fromLat = $('#latitude1').val(coordinates[0]);
            var fromLng = $('#longitude1').val(coordinates[1]);
            var toLat = $('#latitude2').val(coordinates[lastCoordinate - 2]);
            var toLng = $('#longitude2').val(coordinates[lastCoordinate - 1]);
            console.log(fromLat + ' ' + fromLng + ' ' + toLat + ' ' + toLng);
        } else {
            console.error("S/E: There are 4 or more coordinates required to create a polyline. Please check your polyline.")
        }
        return false
    }
})();
