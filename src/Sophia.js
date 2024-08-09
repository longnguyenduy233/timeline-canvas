;(function(global, fabric) {
  var Sophia = function(items, options) {
    return new Sophia.init(items, options);
  }


  var canvas;
  var objectsToScaleDown = [];
  var currentRulerItems = [];
  var currentBackgroundItems = [];
  var defaultZoomThreshold = '3';
  var defaultBackwardZoomThreshold = '0';
  var forwardZoomThreshold = defaultZoomThreshold;
  var backwardZoomThreshold = defaultBackwardZoomThreshold;
  var maxHour = 24;//24h
  var maxHourInSeconds = maxHour * 3_600;
  var rulerOnZoomInSecondsConfig = {
    [defaultZoomThreshold]: 14_400,//4h
    '8': 3_600,//1h
    '22': 900,//15m
    '30': 600,//10m
    '150': 300,//5m
    '450': 60,//1m
    '600': 15,//15s
    '1300': 10,//10s
    '4000': 5,//5s
    '5000': 1,//1s
  };
  var oldZoom = 1;

  Sophia.prototype = {
    setOptions: function(options) {
      this.options = options;
      return this;
    },
  };

  Sophia.init = function(items, options) {
    var self = this;
    self.items = items;
    self.options = options;
    if (!fabric) {
      throw 'Fabric is not loaded';
    }
    canvas = new fabric.Canvas('canvas');

    renderTimelineData();
    handleCanvasZooming();
    handleCanvasPanning();

    drawRuler();
  }

  function redrawRulerItem(jumpSizeInSeconds) {
    var canvasWidth = canvas.getWidth();
    var canvasHeight = canvas.getHeight();
    var canvasCoords = canvas.vptCoords;
    var canvasTopLeft = canvasCoords.tl?.x || 0;
    var canvasTopRight = canvasCoords.tr?.x || canvasWidth;
    if (currentRulerItems.length) {
      canvas.remove(...currentRulerItems);
      currentRulerItems = [];
    }
    if (currentBackgroundItems.length) {
      canvas.remove(...currentBackgroundItems);
      currentBackgroundItems = [];
    }
    var columnCount = maxHourInSeconds / jumpSizeInSeconds;
    var columnSize = canvasWidth / columnCount;
    var jumpCountForStartPoint = Math.floor(canvasTopLeft / columnSize) - 1;
    var startPoint = Math.max(jumpCountForStartPoint * columnSize, 0);
    var startJumpSizeInSeconds = Math.max(jumpCountForStartPoint * jumpSizeInSeconds, 0);
    var jumpCountForEndPoint = Math.ceil(canvasTopRight / columnSize) + 1;
    var endPoint = Math.min(jumpCountForEndPoint * columnSize, canvasWidth);
    for (i = startPoint, j = startJumpSizeInSeconds, k = Math.max(jumpCountForStartPoint, 0); i < endPoint; i += columnSize, j+= jumpSizeInSeconds, k+= 1) {
      var verticalLine = new fabric.Line([i,0,i,20], {
        stroke: 'rgb(128, 128, 116)',
        strokeWidth: 1,
        objectCaching: false
      });
      // Numbers
      var text = new fabric.Text(toTimeString(j), {
        left: i + 5,
        top: 5,
        fontSize: 8,
        strokeWidth: 0,
        objectCaching: false
      });
      var group = new fabric.Group([verticalLine, text], {
        left: i,
        top: 0,
        selectable: false,
        objectCaching: false
      });
      canvas.add(group);
      currentRulerItems.push(group);
      var backgroundColor = k % 2 === 0 ? 'rgb(255, 255, 255)' : 'rgb(245, 245, 245)';
      var backgroundItem = new fabric.Rect({
        top: 0,
        left: i,
        width: columnSize,
        height: canvasHeight,
        fill: backgroundColor,
        selectable: false,
        strokeWidth: 0,
        objectCaching: false
      });
      canvas.add(backgroundItem);
      backgroundItem.sendToBack();
      currentBackgroundItems.push(backgroundItem);
    }
  }

  function drawRuler() {
    var canvasWidth = canvas.getWidth();
    var topLine = new fabric.Line([0,0,canvasWidth,0], {
      stroke: 'rgb(128, 128, 116)',
      strokeWidth: 1,
      selectable: false
    });
    canvas.add(topLine);
    var botLine = new fabric.Line([0,20,canvasWidth,20], {
      stroke: 'rgb(128, 128, 116)',
      strokeWidth: 1,
      selectable: false
    });
    canvas.add(botLine);
    redrawRulerItem(rulerOnZoomInSecondsConfig[defaultZoomThreshold]);
  }

  function handleCanvasPanning() {
    canvas.on('mouse:down', function(opt) {
      var evt = opt.e;
      this.isDragging = true;
      this.selection = false;
      this.lastPosX = evt.clientX;
    });
    canvas.on('mouse:move', function(opt) {
      if (this.isDragging) {
        var e = opt.e;
        var zoom = canvas.getZoom();
        var vpt = this.viewportTransform;
        var canvasWidth = canvas.getWidth();
        vpt[4] += e.clientX - this.lastPosX;
        if (vpt[4] >= 0) {
          vpt[4] = 0;
        } else if (vpt[4] < canvasWidth - canvasWidth * zoom) {
          vpt[4] = canvasWidth - canvasWidth * zoom;
        }
        this.requestRenderAll();
        this.lastPosX = e.clientX;
        redrawRulerItem(rulerOnZoomInSecondsConfig[forwardZoomThreshold]);
        scaleDownObjects(zoom, currentRulerItems);
      }
    });
    canvas.on('mouse:up', function(opt) {
      // on mouse up we want to recalculate new interaction
      // for all objects, so we call setViewportTransform
      this.setViewportTransform(this.viewportTransform);
      this.isDragging = false;
      this.selection = true;
    });
  }
  
  function scaleDownObjects(zoom, objects) {
    //Keep origin size of our objects
    (objects || []).forEach(object => {
      object.setOptions({
        scaleX: 1 / zoom
      });
      object.setCoords();
    })
  }

  function handleCanvasZooming() {
    canvas.on('mouse:wheel', function(opt) {
      var delta = opt.e.deltaY;
      var zoom = canvas.getZoom();
      var canvasWidth = canvas.getWidth();
      // zoom *= 0.999 ** delta;
      zoom += -0.01 * delta;
      if (zoom > 5000) zoom = 5000;
      if (zoom < 1) zoom = 1;

      //handle horizontal zoom
      var point = { x: opt.e.offsetX, y: opt.e.offsetY };
      var before = point,
      vpt = [...this.viewportTransform];
      var newPoint = fabric.util.transformPoint(point, fabric.util.invertTransform(vpt));
      vpt[0] = zoom;
      var after = fabric.util.transformPoint(newPoint, vpt);
      vpt[4] += before.x - after.x;

      //correct translation when user zoom out
      if (vpt[4] >= 0) {
        vpt[4] = 0;
      } else if (vpt[4] < canvasWidth - canvasWidth * zoom) {
        vpt[4] = canvasWidth - canvasWidth * zoom;
      }
      this.setViewportTransform(vpt);

      redrawRulerItemBaseOnZoomLevel(zoom);
      oldZoom = zoom;

      scaleDownObjects(zoom, objectsToScaleDown);
      scaleDownObjects(zoom, currentRulerItems);

      opt.e.preventDefault();
      opt.e.stopPropagation();
    });
  }

  function redrawRulerItemBaseOnZoomLevel(zoom) {
    if (zoom > Number(forwardZoomThreshold)) {
      var configKey = Object.keys(rulerOnZoomInSecondsConfig).find(zoomThresholdKey => zoom < Number(zoomThresholdKey));
      if (configKey) {
        var configValue = rulerOnZoomInSecondsConfig[configKey];
        redrawRulerItem(configValue);
        backwardZoomThreshold = forwardZoomThreshold;
        forwardZoomThreshold = configKey;
      }
    } else if (zoom <= Number(backwardZoomThreshold)) {
      var configKey = Object.keys(rulerOnZoomInSecondsConfig).find(zoomThresholdKey => zoom < Number(zoomThresholdKey));
      if (configKey) {
        var configValue = rulerOnZoomInSecondsConfig[configKey];
        redrawRulerItem(configValue);
        forwardZoomThreshold = configKey;
      }
      var configKeyForBackward = Object.keys(rulerOnZoomInSecondsConfig).reverse().find(zoomThresholdKey => zoom > Number(zoomThresholdKey));
      if (configKeyForBackward) {
        backwardZoomThreshold = configKeyForBackward;
      } else {
        backwardZoomThreshold = defaultBackwardZoomThreshold;
      }
    } else if (zoom < oldZoom) {
      redrawRulerItem(rulerOnZoomInSecondsConfig[forwardZoomThreshold]);
    }
  }

  function toTimeString(seconds) {
    var date = new Date(null);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
  }

  function toTimeNumber(timeString) {
    return timeString.toString().split(':').reduce((acc,time) => (60 * acc) + +time);
  }

  function renderTimelineData() {
    (items || []).forEach(item => {
      var startTimeInSeconds = toTimeNumber(item.startTime);
      if (item.endTime) {
        var endTimeInSeconds = toTimeNumber(item.endTime);
        var duration = endTimeInSeconds - startTimeInSeconds;
        var rect = new fabric.Rect({
          top: 100,
          left: translateSecondsToCanvasCoordinateSystem(startTimeInSeconds),
          width: translateSecondsToCanvasCoordinateSystem(duration),
          height: 30,
          fill: item.color,
          selectable: false,
          strokeWidth: 0
        });
        canvas.add(rect);
      } else {
        var circle = new fabric.Circle({
          top: 100 + 15,
          left: translateSecondsToCanvasCoordinateSystem(startTimeInSeconds),
          radius: 15,
          fill: item.color,
          selectable: false,
          strokeWidth: 2,
          stroke: 'rgba(100,200,200,0.5)',
          originX: 'center',
          originY: 'center'
        });
        canvas.add(circle);
        objectsToScaleDown.push(circle);
      }
    });
  }

  function translateSecondsToCanvasCoordinateSystem(seconds) {
    var canvasWidth = canvas.getWidth();
    return (seconds * canvasWidth) / 86_400;
  }

  Sophia.init.prototype = Sophia.prototype;

  global.Sophia = global.S$ = Sophia;
}(window, fabric));
