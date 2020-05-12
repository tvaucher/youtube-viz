---
---
(function (window) {
  "use strict";
  var App = window.App || {};
  let YoutubePlayer = (function () {
    let lastPosition = null;
    let insideClick = null;
    const minHeight = 50;
    const minWidth = 75;
    const minBorder = 25;
    let isDragging = false;
    let isResizing = false;

    let youtubePlayerBox = document.getElementById("youtubePlayerBox");
    let resizers = youtubePlayerBox.getElementsByClassName("resizer");
    let iframe = document.getElementById("youtubeIframe");
    let closeButton = youtubePlayerBox.getElementsByClassName("topLeft");
    Array.prototype.forEach.call(closeButton, function (b) {
      b.addEventListener("click", function (e) {
        hideYoutubePlayerBox();
      });

      b.addEventListener("mousedown", function (e) {
        e.stopPropagation();
      });
    });

    youtubePlayerBox.addEventListener("mousedown", function (e) {
      //console.log("started to drag")
      insideClick = {
        x: e.clientX - lastPosition.x,
        y: e.clientY - lastPosition.y,
      };
      isDragging = true;
      youtubePlayerBox.classList.add("grabbed");
      iframe.style.pointerEvents = "none";
    });

    Array.prototype.forEach.call(resizers, function (r) {
      r.addEventListener("mousedown", function (e) {
        //console.log("started to resize")
        insideClick = {
          x: e.clientX - lastPosition.x,
          y: e.clientY - lastPosition.y,
        };
        isResizing = true;
        iframe.style.pointerEvents = "none";
        e.stopPropagation();
      });
    });

    document.addEventListener("mouseup", function (e) {
      stopDragging();
      stopResizing();
    });

    document.addEventListener("mousemove", function (e) {
      if (isDragging) {
        move(e);
      } else if (isResizing) {
        resize(e);
      }
    });

    function stopDragging() {
      //console.log("stopped to drag")
      isDragging = false;
      youtubePlayerBox.classList.remove("grabbed");
      iframe.style.pointerEvents = "auto";
    }

    function stopResizing() {
      //console.log("stopped to resize")
      isResizing = false;
      iframe.style.pointerEvents = "auto";
    }

    function makeAppearYoutubePlayerBox(videoId) {
      if (lastPosition == null) {
        //let documentW = document.body.clientWidth;
        //let documentH = document.body.clientHeight;
        let windowW = window.innerWidth;
        let windowH = window.innerHeight;

        let width = Math.max(minWidth, windowW / 2);
        let height = Math.max(minHeight, windowH / 2);
        let x = (windowW - width) / 2;
        let y = (windowH - height) / 2;
        lastPosition = {
          x: x,
          y: y,
          width: width,
          height: height,
        };
        iframe.style.pointerEvents = "auto";
      }

      //size correction
      if(lastPosition.width != null){
        lastPosition.width = Math.max(minWidth, lastPosition.width);
      }
      if(lastPosition.height != null){
        lastPosition.height = Math.max(minHeight, lastPosition.height);
      }
      //position correction
      if(lastPosition.x != null){
        if (lastPosition.x > window.innerWidth - minBorder) {
          lastPosition.x = window.innerWidth - minBorder;
        } else if (lastPosition.x + lastPosition.width < minBorder) {
          lastPosition.x = minBorder - lastPosition.width;
        }
      }
      if(lastPosition.y != null){
        if (lastPosition.y > window.innerHeight - minBorder) {
          lastPosition.y = window.innerHeight - minBorder;
        } else if (lastPosition.y + lastPosition.height < minBorder) {
          lastPosition.y = minBorder - lastPosition.height;
        }
      }

      youtubePlayerBox.style.left = lastPosition.x == null ? null :lastPosition.x + "px";
      youtubePlayerBox.style.top = lastPosition.y == null ? null :lastPosition.y + "px";
      youtubePlayerBox.style.width = lastPosition.width == null ? null : lastPosition.width + "px";
      youtubePlayerBox.style.height = lastPosition.height == null ? null :lastPosition.height + "px";

      if (videoId != undefined && videoId != null) {
        let newUrl = "https://www.youtube.com/embed/" + videoId + "?autoplay=1&origin={{ site.url }}";
        iframe.src = newUrl;
      }
    }

    function hideYoutubePlayerBox() {
      youtubePlayerBox.style.display = "none";
      iframe.src = "";
    }

    function move(e) {
      lastPosition.x = e.clientX - insideClick.x;
      lastPosition.y = e.clientY - insideClick.y;
      makeAppearYoutubePlayerBox();
    }

    function resize(e) {
      let middleWOfWindow = lastPosition.x + lastPosition.width / 2;
      let middleHOfWindow = lastPosition.y + lastPosition.height / 2;
      let isClickTop = e.clientY < middleHOfWindow;
      let isClickLeft = e.clientX < middleWOfWindow;

      let anchorY = isClickTop
      ? lastPosition.y + lastPosition.height
      : lastPosition.y;
      let anchorX = isClickLeft
      ? lastPosition.x + lastPosition.width
      : lastPosition.x;

      let newWidth = Math.abs(e.clientX - anchorX); //+ borderX
      let newHeight = Math.abs(e.clientY - anchorY); //+ borderY

      newWidth = Math.max(minWidth, newWidth);
      newHeight = Math.max(minHeight, newHeight);
      lastPosition.width = newWidth;
      lastPosition.height = newHeight;
      lastPosition.x = isClickLeft ? anchorX - newWidth : lastPosition.x;
      lastPosition.y = isClickTop ? anchorY - newHeight : lastPosition.y;

      makeAppearYoutubePlayerBox();
    }

    return {
      makeAppearYoutubePlayerBox: makeAppearYoutubePlayerBox,
    };
  })();
  App.YoutubePlayer = YoutubePlayer;
  window.App = App;
})(window);
