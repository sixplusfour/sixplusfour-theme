/*!
 * VERSION: 1.0.0
 * DATE: 11/04/2014
 *
 * @license Copyright (c) 2014, SixPlusFour. All rights reserved.

 * @author: George Reith, sixplusfour.co.uk
 **/

var uid = 0;
var canvasSupport;

if (!spfScriptDir) {
  var spfScriptDir = '';
}
if (!spfAnimationDir) {
  var spfAnimationDir = '';
}

// DEBUG -- include "spf-flash" url fragment to force Flash version (e.g., http://example.com#spf-flash)
if (location.hash.match(/#spf-flash(?![^#])/i)) {
  canvasSupport = false;
} else {
  // Detect whether browser supports canvas
  canvasSupport = (function() {
    var elem = document.createElement('canvas');
    return !!(elem.getContext && elem.getContext('2d'));
  })();
}

yepnope({
  test: canvasSupport,
  // Load canvas drawing libraries
  yep: [spfScriptDir + "TweenMax.js", spfScriptDir + "easeljs.js", spfScriptDir + "tweenjs.js", spfScriptDir + "movieclip.js"],
  // Load flash libraries
  nope: ["../common/js/swfobject.js"],
  complete: function() {
    $(function() { // Wait until DOM has loaded
      // Find and load interactivities
      $(".spf-interactive").each(initInteractive);

      yepnope({
        load: scripts,
        callback: callbacks
      })
    });
  }
});

var scripts = [];
var callbacks = {};

/*
 * Gets event data from HTML data attributes and triggers it
 */
var relayEvent = function(e) {
  e.preventDefault();
  var $self = $(this);
  var name = $self.data("event");
  var params = $self.data("params") || [];
  var target = (canvasSupport) ? e.delegateTarget.exportRoot : e.delegateTarget["data-export"];
  sendEvent(name, params, target)
}

/*
 * Converts and routes events to the correct rendering engine
 */
var sendEvent = function(name, params, target) {
  if (name && target) {
    params = params || [];
    if (canvasSupport) {
      var event = new createjs.Event(name);
      event.params = params;
      target.dispatchEvent(event);
    } else if (target["data-loaded"]) {
      target.triggerEvent(name, params);
    }
  }
}

/*
 * Extracts animation data from DOM and initialises the correct rendering engine
 */
var initInteractive = function() {
  var self = this;
  var $self = $(self);
  var resource; // yepnope resource uri
  var callback; // yepnope resource callback
  var responsive = $self.data("responsive");
  var isMovie = $self.data("movie");

  if (responsive) {
    var maxWidth = $self.width();
  }

  $self.on("click", "a[data-event]", relayEvent);
  if (canvasSupport) {
    var root = $self.data("canvas-root");
    if (root) {
      // URI of script to load
      resource = spfAnimationDir + $self.data("canvas-uri");
      // Callback once script has loaded 
      callback = function() {
        var width = lib.properties.width;
        var height = lib.properties.height;
        var scale = 1;

        if (responsive) {
          scale = maxWidth / width;
          width *= scale;
          height *= scale;
        }

        var canvas = $('<canvas />').attr({
          "width": width,
          "height": height
        })[0];
        $self.prepend(canvas);
        var exportRoot = self.exportRoot = new lib[root]();

        var stage = new createjs.Stage(canvas);
        stage.scaleX = stage.scaleY = scale;
        stage.addChild(exportRoot);
        stage.update();

        // Resizes cached objects stored in exportRoot.spf_resizeCache (this.spf_resizeCache in Flash IDE)
        var cached = exportRoot.spf_resizeCache;
        if (scale !== 1 && cached) {
            for (var i = cached.length; i--;) {
              var bounds = cached[i].getBounds();
              cached[i].cache(bounds.x, bounds.y, bounds.width, bounds.height, scale);
            }
        }

        if (isMovie) {
          var $playButton = $self.find("a.spf-play-button").first();
          var playing = $playButton.hasClass('spf-active');
          $playButton.click(function() {
            var $button = $(this);
            if (playing) {
              TweenLite.ticker.removeEventListener("tick");
            } else {
              TweenLite.ticker.addEventListener("tick", stage.update, stage);
            }
          });
        }

        // Find preset active buttons and trigger them
        $self.find("li.spf-active:first-child a").trigger("click");

        // Let easelJS use TweenMax's ticker
        TweenLite.ticker.addEventListener("tick", stage.update, stage);
      }
    }
  } else {
    // load Flash version
    var fallback = spfAnimationDir + $self.data("fallback-uri");
    var objID = "fallback" + uid++;
    var container = $('<div />').attr({
      "id": objID
    })[0];
    $self.prepend(container);
    if (fallback) {
      var dimensions  = $self.data("fallback-size") || [];
      var width = dimensions[0] || "100%";
      var height = dimensions[1] || "100%";
      swfobject.embedSWF(fallback, container, width, height, "10.3.0", null, null, {
        "quality": "high",
        "allowScriptAccess": "always"
      }, {
        "id": objID,
        "name": objID
      }, function(e) {
        var obj = e.ref;
        self["data-export"] = obj;
        if (!e.success || !obj) return false;
        swfLoadEvent(obj, function(){
          obj["data-loaded"] = true;
          // Find preset active buttons and trigger them
          $self.find("li.spf-active:first-child a").trigger("click");
        });
      });
    }
  }

  if (resource) {
    scripts.push(resource);
    callbacks[resource] = callback;
  }
}

function swfLoadEvent(swf, fn){
  //Ensure fn is a valid function
  if(typeof fn !== "function"){ return false; }
  //This timeout ensures we don't try to access PercentLoaded too soon
  var initialTimeout = setTimeout(function (){
    //Ensure Flash Player's PercentLoaded method is available and returns a value
    if(typeof swf.PercentLoaded !== "undefined" && swf.PercentLoaded()){
      //Set up a timer to periodically check value of PercentLoaded
      var loadCheckInterval = setInterval(function (){
        //Once value == 100 (fully loaded) we can do whatever we want
        if(swf.PercentLoaded() === 100){
          //Clear timer
          clearInterval(loadCheckInterval);
          //Execute function
          fn();
        }
      }, 200);
    }
  }, 200);
}


$(function() {
  $(".spf-navbar").on("click", "a", function(e) {
    e.preventDefault();
    var $self = $(this);
    var $parent = $self.parent();
    $parent.addClass("spf-active");
    $parent.siblings(".spf-active").each(function() {
      $(this).removeClass("spf-active");
    });
  })
});