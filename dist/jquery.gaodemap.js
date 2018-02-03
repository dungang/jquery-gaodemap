+ function ($, AMap) {

  var GaodeArea = function ($element, options) {
    this.$element = $element;
    this.options = options;
    //定位城市adcode
    this.locationCity = options.startAdcode;
    //冗余记录经纬度，逗号分隔
    this.locationValue = '';
    //搜索行政服务
    this.search = this.createDistrictSearch();
    this.placeSearch = this.createPlaceSearch();
    //地理位置，经纬度互转
    this.geo = this.createGeocoder();
    //如果设置了地图的容器，则启用地图
    this.map = this.attachMap();
    //绑定省份城市选择等表单组件的事件
    this.bindEvent();
    //搜索起始的adcode，初始化表单组件
    this.searchChildsByAdCode(this.options.startAdcode);
    
    if(options.geo && typeof options.geo == 'object' && options.geo.constructor == Array.prototype.constructor) {
      this.updateMap(options.geo);
      this.locationValue = options.geo.join(',');
    }
  };

  GaodeArea.DEFAULTS = {
    auto: false, //是否在地址输入框变化的时候自动定位
    nearRadius: 500, //周边查询的半径单位米
    map: false, // selector //hotelModal地图控件
    startAdcode: '100000', //其实adcode
    locationBtn: '.location-btn', //定位按钮
    search: {
      subdistrict: 1, //返回下一级行政区
      showbiz: false //最后一级返回街道信息
    },
    geo: {}, //定位器的配置
    onLocationError: $.noop //没找到坐标的时候回掉没有参数
  }

  GaodeArea.Timer = null;

    /**
   * 创建搜索对象
   */
  GaodeArea.prototype.createPlaceSearch = function () {
    return new AMap.PlaceSearch();
  }

  /**
   * 绑定地图
   */
  GaodeArea.prototype.attachMap = function () {
    var _this = this;
    if (this.options.map) {
      return $(this.options.map).gaodePlace({
        placeSearch: _this.placeSearch,
        showInfoWindow: false, //关闭编辑提示窗口
        markerDraggable: true, //开始标记可以拖动
        nearRadius: this.options.nearRadius, //设置周边查询的半径
        //标记拖动结束是触发
        onMarkerDragEnd: function (e) {
          _this.locationValue = [e.lnglat.getLng(), e.lnglat.getLat()].join(',');
        }
      });
    }
    return false;
  }


  /**
   * 更新地图
   * @param {object} data 
   */
  GaodeArea.prototype.updateMap = function (data) {
    if (this.map) {
      this.map.gaodePlace('update', data);
    }
  }

  /**
   * 绑定表单组件的事件
   */
  GaodeArea.prototype.bindEvent = function () {
    var _this = this;
    //查找下拉框框组件，并绑定change事件
    this.$element.find('select').each(function () {
      $(this).off('change.gaodearea')
        .on('change.gaodearea', function () {
          var _select = $(this);
          var option = _select.find('option:selected');
          var district = option.text();
          var adcode = option.val();
          _this.resetChildOptions(_select.data('level'));
          if (adcode) {
            _this.searchChildsByAdCode(adcode);
          }
        });
    });
    //查找定位按钮，并绑定click事件，执行定位
    this.$element.find(this.options.locationBtn)
      .click(function (e) {
        e.preventDefault();
        _this.location();
      });
    //查找地址表单组件，绑定keyup事件，自动执行定位，延迟1000ms后执行
    this.$element.find('[data-level=address]').keyup(function () {
      if (GaodeArea.Timer != null) {
        clearTimeout(GaodeArea.Timer);
        GaodeArea.Timer = null;
      }
      setTimeout(function () {
        _this.autoLocation();
      }, 1000);
    });
  }

  /**
   * 自动定位快捷方法
   */
  GaodeArea.prototype.autoLocation = function () {
    if (this.options.auto) {
      this.location();
    }
  }

  /**
   * 组合options
   * @param {array} list 
   * @param {string} adcode 
   */
  GaodeArea.prototype.renderOptions = function (list, adcode) {
    return $.map(list, function (district) {
      var selected = adcode && district.adcode.toString() == adcode.toString() ? 'selected' : '';
      return '<option value="' + district.adcode + '" ' + selected + '>' +
        district.name +
        '</option>'
    }).join('');
  }

  /**
   * 初始化定位组件
   */
  GaodeArea.prototype.createGeocoder = function () {
    return new AMap.Geocoder(this.options.geo);
  }

  /**
   * 创建搜索对象
   */
  GaodeArea.prototype.createDistrictSearch = function () {
    return new AMap.DistrictSearch(this.options.search);
  }

  /**
   * 清空select的 options
   * @param {array} levels 
   */
  GaodeArea.prototype.resetOptions = function (levels) {
    var _this = this;
    $.map(levels, function (level) {
      _this.findByLevel(level).html('');
    })
  }

  /**
   * 调用地图组件的查询周边的快捷方法
   * @param {string} keywords 
   * @param {function} callback 
   */
  GaodeArea.prototype.searchNearBy = function (keywords, callback) {
    if (this.map) {
      this.map.gaodePlace('searchNearInfo', keywords, callback)
    }
  }

  /**
   * 高级别的level变化时，清空低级别level的options
   * @param {string} level 
   */
  GaodeArea.prototype.resetChildOptions = function (level) {
    if (level == 'province') {
      this.resetOptions(['city', 'district', 'area']);
    } else if (level == 'city') {
      this.resetOptions(['district', 'area']);
    } else {
      this.resetOptions(['area']);
    }
  }

  /**
   * 根据级别查找表单组件
   * @param {string} level 
   */
  GaodeArea.prototype.findByLevel = function (level) {
    return this.$element.find('[data-level=' + level + ']');
  }

  /**
   * 高级别leve的adcode查找第level的行政位置集合
   * @param {string} adCode 
   */
  GaodeArea.prototype.searchChildsByAdCode = function (adCode) {
    var _this = this;
    this.searchDistrict(adCode, function (districtList) {
      if (districtList.length > 0) {
        var district = districtList[0];
        //记录当前级别的center
        var center = district.center;
        if (typeof district.citycode == 'string') {
          _this.locationCity = district.citycode;
        }
        if (district.districtList && district.districtList.length > 0) {
          //如果当前级别的adcode有低level的adcodes，则选择第一个做为地图更新定位的坐标
          //更新center
          center = district.districtList[0].center;
          //结果集合是什么类型的level
          var level = district.districtList[0].level;
          //根据level更新对应的select[data-level]组件
          var renderTarget = _this.findByLevel(level);
          renderTarget.html(_this.renderOptions(district.districtList,renderTarget.data('value')));
          //触发更新，目的是代码组合options更新select的时候，并不发生change事件，
          //导致不能连级触发第level的select更新option
          //所以，手动触发
          renderTarget.trigger('change');
        }
        //根据center实时更新地图的。目的是交互更加的即时。
        _this.updateMap({
          position: [center.lng, center.lat]
        });
        _this.locationValue = [center.lng, center.lat].join(',');
      }
    });
  }
  /**
   * 根据关键字查询地理位置
   * @param {string} district 行政区域关键字
   * @param {function} callback 
   */
  GaodeArea.prototype.searchDistrict = function (district, callback) {
    var _this = this;
    if (district && this.search) {
      this.search.search(district, function (status, result) {
        if (status === 'complete' &&
          result.info === 'OK' &&
          typeof callback == 'function') {
          callback.call(_this, result.districtList);
        }
      });
    }
  };

  /**
   * 获取地址坐标的执行方法
   * @param {string} addr 
   * @param {function} callback 
   */
  GaodeArea.prototype.getLocation = function (addr, callback) {
    var _this = this;
    //定位前，设置定位的城市
    this.geo.setCity(this.locationCity);
    this.geo.getLocation(addr, function (status, result) {
      if (status === 'complete' &&
        result.info === 'OK' &&
        typeof callback == 'function') {
        callback.call(_this, result);
      }
    });
  };

  /**
   * 定位快捷方法
   */
  GaodeArea.prototype.location = function (address) {
    var _this = this;
    //如果没有传递地址，则根据表单组件[data-level=address]的值获取
    if (!address) {
      var addr = this.findByLevel('address');
      if (addr.length > 0) {
        address = addr.val();
      }
    }
    //最终有地址
    if (address) {
      this.getLocation(address, function (result) {
        if (result.geocodes && result.geocodes.length > 0) {
          var location = result.geocodes[0].location;
          _this.updateMap({
            position: [location.lng, location.lat]
          });
          _this.locationValue = [location.lng, location.lat].join(',');
        }
      });
    } else {
      //如果没有，则执行错误方法，留给开发人员根据实际的情况扩展。
      if (typeof this.options.onLocationError == 'function')
        this.options.onLocationError.call(this);
    }
  };

  /**
   * 获取组件的地理信息值对象
   * @param {function} callback 
   */
  GaodeArea.prototype.getValues = function (callback) {
    var values = {
      location: this.locationValue
    };
    this.$element.find('[data-level]').each(function () {
      var input = $(this);
      var level = input.data('level');
      if (input[0].tagName == 'SELECT') {
        var option = input.find('option:selected');
        values[level] = option.val();
        values[level + 'Text'] = option.text();
      } else {
        values[level] = input.val();
      }
    });
    callback.call(this, values);
  }

  function Plugin(option) {
    var args = Array.prototype.slice.call(arguments, 1);
    return this.each(function () {
      var $this = $(this);
      var data = $this.data('map.gaode.area');
      var options = $.extend(true, {}, GaodeArea.DEFAULTS, $this.data(),
        typeof option == 'object' && option);
      if (!data) {
        $this.data('map.gaode.area', (data = new GaodeArea($this, options)));
      }
      if (data && typeof option == 'string') data[option].apply(data, args);
    });
  }

  var old = $.fn.gaodeArea;
  $.fn.gaodeArea = Plugin;
  $.fn.gaodeArea.Constructor = GaodeArea;
  $.fn.gaodeArea.noConflict = function () {
    $.fn.gaodeArea = old;
    return this;
  }

  $(window).on('load', function () {
    var map = $('[data-gaode-area]').gaodeArea();
  });
}(jQuery, AMap);
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