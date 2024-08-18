;(function(global, fabric) {
  var Sophia = function(items, groups, dependencies, options) {
    return new Sophia.init(items, groups, dependencies, options);
  }

  var canvas;
  var canvasWidth;
  var canvasHeight;
  var objectsToScaleDown = [];
  var currentRulerItems = [];
  var currentBackgroundItems = [];
  var markers = [];
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
  var currentTimeVerticalLine;
  var currentTimeVerticalLineInterval;
  var internalDependencies;
  var arrows = [];
  var CustomFabricPath;

  Sophia.prototype = {
    setOptions: function(options) {
      this.options = options;
      return this;
    },
    destroy: function() {
      if (currentTimeVerticalLineInterval) {
        clearInterval(currentTimeVerticalLineInterval);
      }
      return this;
    },
    setZoom: function(zoom) {
      setZoom.call(canvas, zoom);
      return this;
    }
  };

  Sophia.init = function(items, groups, dependencies, options) {
    var self = this;
    var defaultOptions = {
      locale: null,
      timeZone: null,
      marginTopOfItem: 20,
      heightOfItem: 20
    };
    self.items = items;
    self.groups = groups;
    self.options = {
      ...defaultOptions,
      ...options
    };
    self.locale = self.options.locale;
    self.timeZone = self.options.timeZone;
    self.dependencies = dependencies;
    internalDependencies = dependencies;
    if (!fabric) {
      throw 'Fabric is not loaded';
    }
    createCustomFabricPath();
    canvas = new fabric.Canvas('canvas');
    canvasWidth = canvas.getWidth();
    canvasHeight = canvas.getHeight();

    renderTimelineData.call(self);
    handleCanvasZooming();
    handleCanvasPanning();

    drawRuler();
    addCurrentTimeVerticalLine(self.locale, self.timeZone);
    renderAllArrow(self.dependencies);
  }

  function redrawRulerItem(jumpSizeInSeconds) {
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
      var verticalLine = new fabric.Line([i,0,i,canvasHeight], {
        stroke: 'rgb(191, 191, 191)',
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
        objectCaching: false,
        hoverCursor: 'default'
      });
      canvas.add(group);
      group.sendToBack();
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
        objectCaching: false,
        hoverCursor: 'default'
      });
      canvas.add(backgroundItem);
      backgroundItem.sendToBack();
      currentBackgroundItems.push(backgroundItem);
    }
  }

  function drawRuler() {
    var topLine = new fabric.Line([0,0,canvasWidth,0], {
      stroke: 'rgb(191, 191, 191)',
      strokeWidth: 1,
      selectable: false
    });
    canvas.add(topLine);
    var botLine = new fabric.Line([0,20,canvasWidth,20], {
      stroke: 'rgb(191, 191, 191)',
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
      // object.setCoords();
    })
  }

  function handleCanvasZooming() {
    canvas.on('mouse:wheel', function(opt) {
      var delta = opt.e.deltaY;
      var zoom = canvas.getZoom();
      // zoom *= 0.999 ** delta;
      zoom += -0.01 * delta;
      var point = { x: opt.e.offsetX, y: opt.e.offsetY };
      setZoom.call(this, zoom, point);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });
  }

  function setZoom(zoom, point) {
    if (zoom > 5000) zoom = 5000;
    if (zoom < 1) zoom = 1;

    if (!point) {
      point = { x: canvasWidth / 2, y: canvasHeight / 2};
    }

    //handle horizontal zoom
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

    scaleDownObjects(zoom, [...objectsToScaleDown, ...currentRulerItems, currentTimeVerticalLine]);
    if (arrows.length > 0) {
      canvas.remove(...arrows);
      arrows = [];
      renderAllArrow(internalDependencies);
    }
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
    var items = this.items;
    var { heightOfItem, marginTopOfItem } = this.options;
    var groups = this.groups;
    if (items) {
      renderTimelineItem(items, marginTopOfItem, heightOfItem);
      return;
    }
    var top = marginTopOfItem;
    (groups || []).forEach(group => {
      if (group.subgroup) {
        (group.subgroup || []).forEach(subgroup => {
          renderTimelineItem(subgroup.items, top, heightOfItem);
          top += heightOfItem;
        });
      } else {
        renderTimelineItem(group.items, top, heightOfItem);
      }
      top += group.height;
    });
  }

  function renderTimelineItem(items, top, heightOfItem) {
    (items || []).forEach(item => {
      var startTimeInSeconds = toTimeNumber(item.startTime);
      if (item.endTime) {
        var endTimeInSeconds = toTimeNumber(item.endTime);
        var duration = endTimeInSeconds - startTimeInSeconds;
        var rect = new fabric.Rect({
          top: top,
          left: translateSecondsToCanvasCoordinateSystem(startTimeInSeconds),
          width: translateSecondsToCanvasCoordinateSystem(duration),
          height: heightOfItem,
          fill: item.color,
          selectable: false,
          strokeWidth: 0,
          id: item.id
        });
        canvas.add(rect);
      } else {
        var radius = heightOfItem / 2;
        var circle = new fabric.Circle({
          top: top + radius,
          left: translateSecondsToCanvasCoordinateSystem(startTimeInSeconds),
          radius,
          fill: item.color,
          selectable: false,
          strokeWidth: 2,
          stroke: 'white',
          originX: 'center',
          originY: 'center',
          id: item.id
        });
        canvas.add(circle);
        objectsToScaleDown.push(circle);
        markers.push(circle);
      }
    });
  }

  function translateSecondsToCanvasCoordinateSystem(seconds) {
    return (seconds * canvasWidth) / 86_400;
  }

  function getCurrentTimeToSeconds(locale, timeZone) {
    locale = locale || [];
    timeZone = timeZone || undefined;
    var currentTime = new Date().toLocaleTimeString(locale, {hour12: false, timeZone});
    var currentTimeInSeconds = toTimeNumber(currentTime);
    return translateSecondsToCanvasCoordinateSystem(currentTimeInSeconds);
  }

  function addCurrentTimeVerticalLine(locale, timeZone) {
    var left = getCurrentTimeToSeconds(locale, timeZone);
    currentTimeVerticalLine = new fabric.Line([left,0,left,canvasHeight], {
      stroke: 'red',
      strokeWidth: 2,
    });
    canvas.add(currentTimeVerticalLine);
    currentTimeVerticalLineInterval = setInterval(() => {
      var left = getCurrentTimeToSeconds(locale, timeZone);
      currentTimeVerticalLine.set({left});
      currentTimeVerticalLine.bringToFront();
    }, 1000);
  }

  function renderArrow(firstItemId, dependencies) {
    var dependency = dependencies.find(dependency => dependency.firstItemId === firstItemId);
    if (dependency) {
      var {secondItemId} = dependency;
      var firstItem = markers.find(marker => marker.id === firstItemId);
      var secondItem = markers.find(marker => marker.id === secondItemId);
      if (firstItem && secondItem) {
        var zoom = canvas.getZoom();
        var lineStrokeWidth = 2;
        var arrowHeadPath = `M 0 0 L -10 -5 L -7.5 0 L -10 5 z`;
        var arrowHead = new fabric.Path(arrowHeadPath, {
          strokeWidth: lineStrokeWidth,
          stroke: "#9c0000",
          // stroke: "white",
          // fill: 'white',
          fill: '#9c0000',
          shadow: 'rgba(0,0,0,0.5) 0px 0px 1px',
          scaleX: 1 / zoom,
        });
        var itemHeight = firstItem.height / zoom;
        var curveLen = itemHeight * 2;
        var path;
        if (secondItem.aCoords.tl.x < firstItem.aCoords.tl.x) {
          var secondItemRight = secondItem.aCoords.tr.x + (arrowHead.getScaledWidth() - (2.5 / zoom));
          var firstItemLeft = firstItem.aCoords.tl.x;
          path = `M ${secondItemRight},${secondItem.oCoords.mr.y} C ${secondItemRight + curveLen},${secondItem.oCoords.mr.y} ${firstItemLeft - curveLen},${firstItem.oCoords.ml.y} ${firstItemLeft},${firstItem.oCoords.ml.y}`;
          arrowHead.set({
            left: secondItem.aCoords.tr.x,
            top: secondItem.oCoords.ml.y - (arrowHead.height / 2) - (lineStrokeWidth / 2),
            flipX: true
          });
        } else {
          var secondItemLeft = secondItem.aCoords.tl.x - (arrowHead.getScaledWidth() - (2.5 / zoom));
          var firstItemRight = firstItem.aCoords.tr.x;
          path = `M ${firstItemRight},${firstItem.oCoords.mr.y} C ${firstItemRight + curveLen},${firstItem.oCoords.mr.y} ${secondItemLeft - curveLen},${secondItem.oCoords.ml.y} ${secondItemLeft},${secondItem.oCoords.ml.y}`;
          arrowHead.set({
            left: secondItemLeft - (2.5 / zoom),
            top: secondItem.oCoords.ml.y - (arrowHead.height / 2) - (lineStrokeWidth / 2)
          });
        }
        var cubicCurve = new CustomFabricPath(path, {
          strokeWidth: lineStrokeWidth,
          stroke: "#9c0000",
          // stroke: "white",
          fill: false,
          shadow: 'rgba(0,0,0,0.5) 0px 0px 1px',
        });

        var group = new fabric.Group([cubicCurve, arrowHead], {
          selectable: true,
          objectCaching: false,
          hoverCursor: 'default'
        });
        canvas.add(group);
        arrows.push(group);
      }
    }
  }

  function createCustomFabricPath() {
    CustomFabricPath = fabric.util.createClass(fabric.Path, {
      _renderStroke : function(ctx) {
        var zoom = canvas.getZoom();
        if (!this.stroke || this.strokeWidth === 0) {
          return;
        }
        if (this.shadow && !this.shadow.affectStroke) {
          this._removeShadow(ctx);
        }
        ctx.save();
        ctx.scale(1/zoom, 1);
        if (this.strokeUniform && this.group) {
          var scaling = this.getObjectScaling();
          ctx.scale(1 / scaling.scaleX, 1 / scaling.scaleY);
        }
        else if (this.strokeUniform) {
          ctx.scale(1 / this.scaleX, 1 / this.scaleY);
        }
        this._setLineDash(ctx, this.strokeDashArray);
        this._setStrokeStyles(ctx, this);
        ctx.stroke();
        ctx.restore();
      }
    }); 
  }

  function renderAllArrow(dependencies) {
    dependencies.forEach(dependency => {
      var {firstItemId} = dependency;
      renderArrow(firstItemId, dependencies);
    });
  }

  Sophia.init.prototype = Sophia.prototype;

  global.Sophia = global.S$ = Sophia;
}(window, fabric));
