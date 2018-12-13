// ==UserScript==
// @name         Wegstatus Get Start / End From Polyline
// @namespace    http://wegstatus.nl/
// @version      0.1.0
// @description  Adds a button to the Wegstatus Reportal to get the start and end location from the polyline.
// @author       Sjors "GigaaG" Luyckx
// @match        https://www.wegstatus.nl/*
// @updateURL    https://raw.githubusercontent.com/GigaaG/wegstatus-polyline-selector/master/ws-import-polyline.js
// @downloadURL  https://raw.githubusercontent.com/GigaaG/wegstatus-polyline-selector/master/ws-import-polyline.js
// @supportURL   https://github.com/GigaaG/wegstatus-polyline-selector/issues

// ==/UserScript==
// De matchurl die niet werkt: /^https\:\/\/www.wegstatus.nl\/(reportal|roadworknl)\/

(function() {
    
    console.log("S/E: Start script");
    
    // Get the polyline element
    var polylineElement = document.getElementsByClassName('col-xs-10')[2];

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
        }
    }
    return false
})();
