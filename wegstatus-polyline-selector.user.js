// ==UserScript==
// @name         Wegstatus Polyline Selector
// @namespace    https://wegstatus.nl
// @version      2019.05.8.13
// @description  Adds a link in the segment-panel to grab the polyline.
// @author       Xander "Xanland" Hoogland & Sjors "GigaaG" Luyckx
// @include      /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor([^\/]?.*)?$/

// ==/UserScript==

(function () {
    const copyText = 'Click to copy';
    $('head').append('<style type="text/css">#grab-polyline { background-image: url(https://www.wegstatus.nl/favicon-16x16.png); background-repeat: no-repeat; background-size: 20px 20px; background-position-x: 32%; background-position-y: 40%;}</style>');

    function bootstrap(tries = 1) {
        if (W && W.map &&
            W.model && W.loginManager.user &&
            $ ) {
            init();
        } else if (tries < 1000)
            setTimeout(function () {bootstrap(tries++);}, 200);
    }

    function init(){
        var targetNode = document.querySelector("#edit-panel");
        // Options for the observer (which mutations to observe)
        var config = {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        };
        // Callback function to execute when mutations are observed
        var callback = function(mutationsList, observer) {
            const selectedItemsCount = W.selectionManager.getSelectedFeatures().length;
            if (selectedItemsCount >= 1) {
                if ($("#grab-polyline").length == 0){
                    // Easy hack to show the button in F(ix)U(I)
                    const $fuButtons = $('#edit-panel .more-actions');
                    if ($fuButtons.css('display') == 'inline-flex') {
                        $fuButtons.css('display', 'initial');
                        $('head').append('<style type="text/css">#grab-polyline { background-position-x: 10%; }</style>');
                    }
                    $('#segment-edit-general > div.form-group.more-actions').append('<div class="edit-house-numbers-btn-wrapper"><button class="action-button waze-btn waze-btn-white" id="grab-polyline" title="' + copyText + '"><span style="margin-left: 15px">Grab polyline v2</span></button><textarea id="grab-polyline-textarea" style="display:none"></textarea></div>');
                    $('#grab-polyline').tooltip({ trigger: 'hover' });
                    addClickHanderForGrabPolylineButton();
                }
            } else {
                $('#grab-polyline').parent().remove();
            }
        };

        // Create an observer instance linked to the callback function
        var observer = new MutationObserver(callback);

        // Start observing the target node for configured mutations
        observer.observe(targetNode, config);
    }

    function addClickHanderForGrabPolylineButton() {
        $('#grab-polyline').click(function () {
            let polyline = '';
            var countSegments = W.selectionManager.getSegmentSelection().segments.length
            const feature = W.selectionManager.getSegmentSelection().segments

            for (var a = 0 ; a < countSegments ; a++){
                const component = feature[a].geometry.components
                if (feature[a].attributes.fwdDirection == false && feature[a].attributes.revDirection == true){
                    component.reverse();
                }
                var points = component.length;
                for (var b = 0 ; b < points ; b++){
                    var coordinates = component[b].clone().transform(W.map.getProjection(), 'EPSG:4326');
                    var x = coordinates.x
                    var y = coordinates.y
                    var latlon = ''+ y +' '+ x +' ';
                    polyline += latlon
                    console.log(latlon);
                }
            }

            $('#grab-polyline-textarea').val(polyline.trim());
            const copyText = document.querySelector("#grab-polyline-textarea");
            $('#grab-polyline-textarea').show();
            copyText.select();
            document.execCommand("copy");
            $('#grab-polyline-textarea').hide();
            $('#grab-polyline').next(".tooltip").find(".tooltip-inner").text('Polyline copied!');
            setTimeout(function () {
                $('#grab-polyline').next(".tooltip").find(".tooltip-inner").text('Click to copy');
            }, 3000);
        });
    }

    bootstrap();
})();
