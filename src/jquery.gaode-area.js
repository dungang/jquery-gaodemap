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