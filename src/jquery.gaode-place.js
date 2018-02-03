+ function ($, AMap) {
  /**
   * 地理目标地图对象
   * data-position 定位的坐标 '[1,1]'
   * data-name 标题
   * data-addr 地址
   * data-near-box 周边容器
   * data-hotels-box 地理目标列表容器
   * data-near-size 关键字查询的条目数量
   * data-near-radius 周边查询的半径 单米
   * data-map json 对象 配置 地图的参数
   * data-adcode 城市编号
   * @param {element} element 
   * @param {object} options {position:[],name:'',addr:'',nearBox:'',nearSize:5}
   */
  var GaodePlace = function (element, options) {
    this.element = $(element);
    this.options = options;
    this.map = new AMap.Map(element, options.map);
    //标记
    this.marker = this.createMarker();
    //标记信息窗口
    this.infoWindow = this.createMarkerInfoWindow();
    //周边信息容器(可选)
    this.nearBox = this.createNearBox();
    //搜索服务
    this.search = this.createPlaceSearch(options.placeSearch);
    this.search.setType(this.options.searchType);
    //地图元素的data属性作为配置项
    //获取名称和地址
    this.update(this.options);
    this.updatePlace();
  };

  GaodePlace.DEFAULTS = {
    map: {
      resizeEnable: true,
      zoom: 13
    },
    showInfoWindow:true,
    nearSize: 5,
    nearRadius: 500,
    markerDraggable:false,
    searchType: '交通设施服务|风景名胜|教文化服务',
    onMarkerDragEnd:$.noop,
    onMarkerClick:$.noop,
    placeSearch:null
  };

  /**
   * 获取对象的配置选项
   */
  GaodePlace.prototype.getOptions = function(){
    return this.options;
  }

  /**
   * 重置地图缩放级别
   * @param {int} zoom 
   */
  GaodePlace.prototype.resetZoom = function() {
    this.map.setZoom(this.options.map.zoom);
  }

  /**
   * 重新设置中心点
   * @param {array} position  [lng, lat]
   */
  GaodePlace.prototype.resetMapCenter = function (position) {
    this.resetZoom();
    this.map.setCenter(new AMap.LngLat(position[0], position[1]));
    this.options.position = position;
  };

  /**
   *  创建地标 标识
   */
  GaodePlace.prototype.createMarker = function () {
    var marker = new AMap.Marker({
      map: this.map,
      position: this.map.getCenter(),
      draggable:this.options.markerDraggable
    });
    if(this.options.markerDraggable) {
      if(typeof this.options.onMarkerDragEnd == 'function') {
        marker.on('dragend',this.options.onMarkerDragEnd);
      }
      if(typeof this.options.onMarkerClick == 'function') {
        marker.on('click',this.options.onMarkerClick);
      }
    }
    return marker;
  };

  GaodePlace.prototype.getMarkerPosition = function() {
    return this.marker.getPosition();
  }
  /**
   * 更新编辑的位置
   * @param {LngLat} position 
   */
  GaodePlace.prototype.resetMarkerPosition = function (position) {
    this.marker.setPosition(position);
  }

  /**
   * 创建标记的提示窗口
   */
  GaodePlace.prototype.createMarkerInfoWindow = function () {
    if(this.options.showInfoWindow) {
      return new AMap.InfoWindow({
        isCustom: true,
        //基点指向marker的头部位置
        offset: new AMap.Pixel(0, -40)
      });
    }
    return false;
  };


  /**
   * 如果设置的周边信息的容器，则创建
   */
  GaodePlace.prototype.createNearBox = function () {
    if (this.options.nearBox) {
      return $(this.options.nearBox);
    }
    return null;
  };

  /**
   * 创建搜索对象
   * @param {PlaceSearch} placeSearch
   */
  GaodePlace.prototype.createPlaceSearch = function (placeSearch) {
    if(placeSearch !=null) {
      return placeSearch;
    }
    return new AMap.PlaceSearch();
  }

  /**
   * 渲染周边信息
   * @param {object} items 
   */
  GaodePlace.prototype.renderNearInfo = function (items) {
    var limit = parseInt(this.options.nearSize);
    var html = '';
    for (var i in items) {
      //取数据前五条
      if (i > limit) {
        break;
      }
      var name = items[i].name;
      var distance = parseInt(items[i].distance);
      var unit = '米';
      if(distance > 1000) {
        distance = distance / 1000;
        distance = distance.toFixed(2);
        unit = '公里';
      }
      html += '<div class="item">' +
        '<div class="item-heading">' + name + '</div>' +
        '<div class="item-content text-gray">驾车距离 ' +
        '<span class="text-red">' + distance + '</span> '+ unit +
        '</div></div>';
    }
    return html;
  }

  /**
   * 根据关键字搜索周边，更新对应的容器
   * @param {string} keyword 
   * @param {object}  
   */
  GaodePlace.prototype.searchNearPosition = function (keyword, $infoBox) {
    var _this = this;
    this.searchNearInfo(keyword,function(pois){
      $infoBox.html(_this.renderNearInfo(pois));
    })
  };

  /**
   * 当没有地理位置的时候，更加 地理目标名称和地址查询地理位置
   * @param {string} name 
   * @param {string} addr 
   */
  GaodePlace.prototype.updateWithoutPosition = function(name,addr) {
    var _this = this;
    this.searchInfo(addr + ' ' + name,function(pois){
      if(pois.length > 0) {
        var location = pois[0].location;
        lng = location.lng;
        lat = location.lat;
        _this.updateWithPosition([location.lng,location.lat],name,addr);
      }
    });
  }

  /**
   * 查询周边
   * @param {string} keyword 
   * @param {function} callback 
   */
  GaodePlace.prototype.searchNearInfo = function(keyword,callback){
    var _this = this;
    if (keyword && this.search) {
      this.search.searchNearBy(keyword, this.map.getCenter(), this.options.nearRadius, function (status, result) {
        if (status === 'complete' && result.info === 'OK' && typeof callback == 'function') {
          callback.call(_this,result.poiList.pois);
        }
      });
    }
  };

    /**
   * 根据关键字查询地理位置
   * @param {string} keyword 
   * @param {function} callback 
   */
  GaodePlace.prototype.searchInfo = function(keyword,callback){
    var _this = this;
    if (keyword && this.search) {
      this.search.search(keyword,function (status, result) {
        if (status === 'complete' && result.info === 'OK' && typeof callback == 'function') {
          callback.call(_this,result.poiList.pois);
        }
      });
    }
  };

  /**
   * 在周边容器中查找需要渲染的周边关键字
   */
  GaodePlace.prototype.searchBearBy = function() {
    var _this = this;
    if(this.nearBox) {
      this.nearBox.find('[data-near-info]').each(function(){
        var $this = $(this);
        var near = $this.data('near-info');
        _this.searchNearPosition(near,$this);
      });
    }
  }

  /**
   * 打开标记信息的窗口
   */
  GaodePlace.prototype.openMarkerInfoWindow = function () {
    if(this.infoWindow){
      this.infoWindow.open(this.map, this.marker.getPosition());
    }
    this.searchBearBy();
  }

  /**
   * 关闭标记信息窗口
   */
  GaodePlace.prototype.closeMarkerInfoWindow = function () {
    this.map.clearInfoWindow();
  }

    /**
   * 更新标记窗口的信息
   * @param {string} name 
   * @param {string} addr 
   */
  GaodePlace.prototype.updateMarkerInfo = function (name, addr) {
    if(this.infoWindow) {
      var content = ['<div class="popover top" style="display:block;position:relative;">'];
      content.push('<div class="arrow" style="left:50%;bottom:-10px;"></div>')
      content.push('<h3 class="popover-title"><strong>' + name + '</strong></h3>');
      content.push('<div class="popover-content"><strong>地址：</strong>' + addr + '</div>');
      content.push('</div>')
      this.infoWindow.setContent(content.join(''));
      this.openMarkerInfoWindow();
      this.options.name = name;
      this.options.addr = addr;
    }
  }

  /**
   * 更新地图信息
   * @param {LngLat} position 
   * @param {String} name 
   * @param {String} addr 
   */
  GaodePlace.prototype.update = function (data) {
    if(this.canUpdate(data)) {
      this.updateWithPosition(data.position, data.name, data.addr)
    } else if (this.canUpdateWithoutPosition(data)) {
      this.updateWithoutPosition(data.name,data.addr)
    }
  }

  /**
   * 更加地理位置更新地图
   * @param {array} position 
   * @param {string} name 
   * @param {string} addr 
   */
  GaodePlace.prototype.updateWithPosition = function (position, name, addr) {
    this.resetMapCenter(position);
    this.resetMarkerPosition(new AMap.LngLat(position[0], position[1]));
    this.updateMarkerInfo(name, addr);
  }

  /**
   * 完整的信息，包括地理位置
   * @param {object} data 
   */
  GaodePlace.prototype.canUpdate = function(data) {
    return typeof data.position == 'object' 
    && data.position.length == 2;
  }

  /**
   * 数据是否可以更新当没有地理信息的时候，更加公司名称，地址查询
   * @param {object} data 
   */
  GaodePlace.prototype.canUpdateWithoutPosition = function(data) {
    return data.name || data.addr;
  }

  GaodePlace.prototype.updatePlace = function(){
    var _this = this;
    if(this.options.hotelsBox) {
      $(this.options.hotelsBox).on('mouseover', ' [data-map-info]', function () {
        _this.update($(this).data());
      });
    }
  };

  function Plugin(option) {
    var args = Array.prototype.slice.call(arguments, 1);
    return this.each(function () {
      var $this = $(this);
      var data = $this.data('map.gaode.place');
      var options = $.extend(true, {}, GaodePlace.DEFAULTS, $this.data(),
        typeof option == 'object' && option);
      if (!data) {
        $this.data('map.gaode.place', (data = new GaodePlace(this, options)));
      }
      if (data && typeof option == 'string') data[option].apply(data, args);
    });
  }

  var old = $.fn.gaodePlace;
  $.fn.gaodePlace = Plugin;
  $.fn.gaodePlace.Constructor = GaodePlace;
  $.fn.gaodePlace.noConflict = function () {
    $.fn.gaodePlace = old;
    return this;
  }

  $(window).on('load', function () {
    var map = $('[data-gaode-place]').gaodePlace();
  });

}(jQuery, AMap);