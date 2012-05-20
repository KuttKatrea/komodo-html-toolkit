(function() {
  var $toolkit, clearEncoding, clearEverything, clearIndentation, currentView, encodingSvc, encodingsBuilt, eventHandler, eventName, events, indentationBuilt, indentationsList, lastEncodingLongName, lastEncodingName, lastEncodingPythonName, lastEncodingUseBOM, lastIndentHardTabs, lastIndentLevels, lastIndentTabWidth, lastNewlineEndings, newlineEndings, pollingTimer, restartPolling, root, startPolling, stopPolling, stopPollingAndClear, _base;
  root = this;
  root.extensions || (root.extensions = {});
  $toolkit = (_base = root.extensions).htmlToolkit || (_base.htmlToolkit = {});
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  const POLLING_INTERVAL = 1000;
  encodingSvc = Cc['@activestate.com/koEncodingServices;1'].getService(Ci.koIEncodingServices);
  pollingTimer = null;
  newlineEndings = ['LF', 'CR', 'CRLF'];
  indentationBuilt = false;
  indentationsList = [2, 3, 4, 8];
  encodingsBuilt = false;
  lastEncodingName = null;
  lastEncodingLongName = null;
  lastEncodingPythonName = null;
  lastEncodingUseBOM = null;
  lastNewlineEndings = null;
  lastIndentHardTabs = null;
  lastIndentLevels = null;
  lastIndentTabWidth = null;
  clearEncoding = function() {
    var encodingWidget;
    encodingWidget = document.getElementById('statusbar-new-encoding-button');
    encodingWidget.removeAttribute('label');
    lastEncodingName = null;
    lastEncodingLongName = null;
    lastEncodingPythonName = null;
    lastEncodingUseBOM = null;
    return lastNewlineEndings = null;
  };
  clearIndentation = function() {
    var indentationWidget;
    indentationWidget = document.getElementById('statusbar-indentation-button');
    indentationWidget.removeAttribute('label');
    lastIndentHardTabs = null;
    lastIndentLevels = null;
    return lastIndentTabWidth = null;
  };
  clearEverything = function() {
    clearEncoding();
    return clearIndentation();
  };
  startPolling = function(view) {
    var block, id;
    block = function() {
      var encodingButtonText, encodingWidget, indentationButtonText, indentationWidget, newEncodingLongName, newEncodingName, newEncodingPythonName, newEncodingUseBOM, newIndentHardTabs, newIndentLevels, newIndentTabWidth, newNewlineEndings;
      if (!(view != null ? view.koDoc : void 0)) {
        return clearEverything();
      }
      try {
        if (view.getAttribute('type') === 'editor') {
          newEncodingName = view.koDoc.encoding.short_encoding_name;
          newEncodingPythonName = view.koDoc.encoding.python_encoding_name;
          newEncodingLongName = view.koDoc.encoding.friendly_encoding_name;
          newEncodingUseBOM = view.koDoc.encoding.use_byte_order_marker;
          newNewlineEndings = view.koDoc.new_line_endings;
          if (lastEncodingName !== newEncodingName || lastEncodingPythonName !== newEncodingPythonName || lastEncodingLongName !== newEncodingLongName || lastEncodingUseBOM !== newEncodingUseBOM || lastNewlineEndings !== newNewlineEndings) {
            encodingButtonText = newEncodingName;
            if (newEncodingUseBOM) {
              encodingButtonText += '+BOM';
            }
            encodingButtonText += ": " + newlineEndings[newNewlineEndings];
            encodingWidget = document.getElementById('statusbar-new-encoding-button');
            encodingWidget.setAttribute('label', encodingButtonText);
            lastEncodingName = newEncodingName;
            lastEncodingPythonName = newEncodingPythonName;
            lastEncodingLongName = newEncodingLongName;
            lastEncodingUseBOM = newEncodingUseBOM;
            lastNewlineEndings = newNewlineEndings;
          }
          if (view.scimoz) {
            newIndentHardTabs = view.scimoz.useTabs;
            newIndentLevels = view.scimoz.indent;
            newIndentTabWidth = view.scimoz.tabWidth;
            if (lastIndentHardTabs !== newIndentHardTabs || lastIndentLevels !== newIndentLevels || lastIndentTabWidth !== newIndentTabWidth) {
              indentationButtonText = "" + (newIndentHardTabs ? 'Tabs' : 'Soft Tabs') + ": ";
              indentationButtonText += newIndentLevels;
              if (newIndentLevels !== newIndentTabWidth) {
                indentationButtonText += " [" + newIndentTabWidth + "]";
              }
              indentationWidget = document.getElementById('statusbar-indentation-button');
              indentationWidget.setAttribute('label', indentationButtonText);
              lastIndentHardTabs = newIndentHardTabs;
              lastIndentLevels = newIndentLevels;
              return lastIndentTabWidth = newIndentTabWidth;
            }
          } else {
            return clearIndentation();
          }
        } else {
          return clearEverything();
        }
      } catch (e) {
        return clearEverything();
      }
    };
    block();
    pollingTimer = setInterval(block, POLLING_INTERVAL);
    return id = pollingTimer;
  };
  stopPolling = function() {
    if (!pollingTimer) {
      return;
    }
    clearInterval(pollingTimer);
    return pollingTimer = null;
  };
  stopPollingAndClear = function() {
    stopPolling();
    return clearEverything();
  };
  restartPolling = function(event) {
    if (ko.views.manager.batchMode) {
      return;
    }
    stopPolling();
    return startPolling(event.originalTarget);
  };
  events = {
    current_view_changed: restartPolling,
    view_closed: stopPollingAndClear
  };
  currentView = function() {
    var view, _ref;
    view = (_ref = ko.views.manager) != null ? _ref.currentView : void 0;
    if (view && view.getAttribute('type') === 'editor' && view.koDoc && view.scimoz) {
      return view;
    } else {
      return false;
    }
  };
  for (eventName in events) {
    eventHandler = events[eventName];
    root.addEventListener(eventName, eventHandler, true);
  }
  ko.main.addWillCloseHandler(function() {
    var eventHandler, eventName, _results;
    _results = [];
    for (eventName in events) {
      eventHandler = events[eventName];
      _results.push(root.removeEventListener(eventName, eventHandler, true));
    }
    return _results;
  });
  $toolkit.statusbar || ($toolkit.statusbar = {});
  $toolkit.statusbar.updateViewLineEndings = function(mode) {
    var view;
    if (lastNewlineEndings === mode) {
      return;
    }
    if (!(view = currentView())) {
      return;
    }
    view.koDoc.new_line_endings = mode;
    view.koDoc.prefs.setStringPref('endOfLine', newlineEndings[mode]);
    return restartPolling({
      originalTarget: view
    });
  };
  $toolkit.statusbar.updateViewExistingEndings = function() {
    var view;
    if (!(view = currentView())) {
      return;
    }
    return view.koDoc.existing_line_endings = lastNewlineEndings;
  };
  $toolkit.statusbar.updateViewEncoding = function(pythonName) {
    var applyButton, cancelButton, choice, errorCode, errorMessage, lastErrorSvc, message, newEncoding, question, view, viewEncoding, warning;
    if (lastEncodingPythonName === pythonName) {
      return;
    }
    if (!(view = currentView())) {
      return;
    }
    if (!(newEncoding = encodingSvc.get_encoding_info(pythonName))) {
      return;
    }
    viewEncoding = Cc['@activestate.com/koEncoding;1'].createInstance(Ci.koIEncoding);
    viewEncoding.python_encoding_name = pythonName;
    viewEncoding.use_byte_order_marker = newEncoding.byte_order_marker && lastEncodingUseBOM;
    warning = view.koDoc.languageObj.getEncodingWarning(viewEncoding);
    question = $toolkit.l10n('htmltoolkit').formatStringFromName('areYouSureThatYouWantToChangeTheEncoding', [warning], 1);
    if (warning === '' || ko.dialogs.yesNo(question, 'No') === 'Yes') {
      try {
        view.koDoc.encoding = viewEncoding;
        view.lintBuffer.request();
        return restartPolling({
          originalTarget: view
        });
      } catch (error) {
        lastErrorSvc = Cc['@activestate.com/koLastErrorService;1'].getService(Ci.koILastErrorService);
        errorCode = lastErrorSvc.getLastErrorCode();
        errorMessage = lastErrorSvc.getLastErrorMessage();
        if (errorCode === 0) {
          message = $toolkit.l10n('htmltoolkit').formatStringFromName('internalErrorSettingTheEncoding', [view.koDoc.displayPath, pythonName], 2);
          return ko.dialogs.internalError(message, "" + message + "\n\n" + errorMessage, error);
        } else {
          question = $toolkit.l10n('htmltoolkit').formatStringFromName('forceEncodingConversion', [errorMessage], 1);
          choice = ko.dialogs.customButtons(question, ["&" + (applyButton = $toolkit.l10n('htmltoolkit').GetStringFromName('forceEncodingApplyButton')), "&" + (cancelButton = $toolkit.l10n('htmltoolkit').GetStringFromName('forceEncodingCancelButton'))], cancelButton);
          if (choice === applyButton) {
            try {
              view.koDoc.forceEncodingFromEncodingName(pythonName);
              return restartPolling({
                originalTarget: view
              });
            } catch (error) {
              message = $toolkit.l10n('htmltoolkit').formatStringFromName('internalErrorForcingTheEncoding', [view.koDoc.displayPath, pythonName], 2);
              return ko.dialogs.internalError(message, "" + message + "\n\n" + errorMessage, error);
            }
          }
        }
      }
    }
  };
  $toolkit.statusbar.updateViewEncodingBOM = function() {
    var bomEl, useBOM, view;
    if (!(view = currentView())) {
      return;
    }
    bomEl = document.getElementById('contextmenu_encodingUseBOM');
    if (lastEncodingUseBOM === (useBOM = bomEl.getAttribute('checked') === 'true')) {
      return;
    }
    view.koDoc.encoding.use_byte_order_marker = useBOM;
    view.koDoc.isDirty = true;
    return restartPolling({
      originalTarget: view
    });
  };
  $toolkit.statusbar.updateViewIndentation = function(levels) {
    var view;
    if (levels === lastIndentLevels) {
      return;
    }
    if (!(view = currentView())) {
      return;
    }
    view.scimoz.tabWidth = view.scimoz.indent = levels;
    view.koDoc.prefs.setLongPref('indentWidth', levels);
    view.koDoc.prefs.setLongPref('tabWidth', levels);
    return restartPolling({
      originalTarget: view
    });
  };
  $toolkit.statusbar.updateViewHardTabs = function(useTabs) {
    var view;
    if (useTabs === lastIndentHardTabs) {
      return;
    }
    if (!(view = currentView())) {
      return;
    }
    view.scimoz.useTabs = useTabs;
    view.koDoc.prefs.setBooleanPref('useTabs', useTabs);
    return restartPolling({
      originalTarget: view
    });
  };
  $toolkit.statusbar.updateLineEndingsMenu = function() {
    var convertEl, index, itemsList, lineEndingsMenu, type, _len;
    lineEndingsMenu = document.getElementById('statusbar-line-endings-menu');
    itemsList = {
      LF: document.getElementById('contextmenu_lineEndingsUnix'),
      CR: document.getElementById('contextmenu_lineEndingsMac'),
      CRLF: document.getElementById('contextmenu_lineEndingsDOSWindows')
    };
    for (index = 0, _len = newlineEndings.length; index < _len; index++) {
      type = newlineEndings[index];
      if (lastNewlineEndings != null) {
        itemsList[type].removeAttribute('disabled');
        itemsList[type].setAttribute('checked', lastNewlineEndings === index ? true : false);
      } else {
        itemsList[type].setAttribute('disabled', true);
        itemsList[type].setAttribute('checked', false);
      }
    }
    convertEl = document.getElementById('contextmenu_lineEndingsConvertExisting');
    if (lastNewlineEndings != null) {
      return convertEl.removeAttribute('disabled');
    } else {
      return convertEl.setAttribute('disabled', true);
    }
  };
  $toolkit.statusbar.updateEncodingsMenu = function() {
    var bomEl, encodingsMenu, index, itemEl, lastEncoding, popupEl, updateChecked, updateClass, updateDisabled;
    encodingsMenu = document.getElementById('statusbar-encodings-menu');
    if (!encodingsBuilt) {
      popupEl = ko.widgets.getEncodingPopup(encodingSvc.encoding_hierarchy, true, 'window.extensions.htmlToolkit.statusbar.updateViewEncoding(this.getAttribute("data"));');
      updateClass = function(node) {
        var child, _i, _len, _ref, _results;
        node.setAttribute('class', 'statusbar-label');
        if (node.getAttribute('data') != null) {
          node.setAttribute('type', 'checkbox');
        }
        if (node.childNodes.length) {
          _ref = node.childNodes;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            child = _ref[_i];
            _results.push(updateClass(child));
          }
          return _results;
        }
      };
      updateClass(popupEl);
      while (popupEl.childNodes.length) {
        encodingsMenu.insertBefore(popupEl.firstChild, encodingsMenu.firstChild);
      }
      encodingsBuilt = true;
    }
    if (lastEncodingPythonName != null) {
      index = encodingSvc.get_encoding_index(lastEncodingPythonName);
    }
    if (index < 0) {
      itemEl = document.createElementNS(XUL_NS, 'menuitem');
      itemEl.setAttribute('data', lastEncodingPythonName);
      itemEl.setAttribute('label', lastEncodingLongName);
      itemEl.setAttribute('oncommand', 'window.extensions.htmlToolkit.statusbar.updateViewEncoding(this.getAttribute("data"));');
      encodingsMenu.insertBefore(itemEl, encodingsMenu.firstChild);
    }
    updateChecked = function(node) {
      var child, pythonName, _i, _len, _ref, _results;
      node.removeAttribute('disabled');
      if ((pythonName = node.getAttribute('data')) != null) {
        node.setAttribute('checked', pythonName === lastEncodingPythonName ? true : false);
      }
      if (node.childNodes.length) {
        _ref = node.childNodes;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          _results.push(updateChecked(child));
        }
        return _results;
      }
    };
    updateDisabled = function(node) {
      var child, pythonName, _i, _len, _ref, _results;
      if (!node.childNodes.length) {
        node.setAttribute('disabled', true);
      }
      if ((pythonName = node.getAttribute('data')) != null) {
        node.setAttribute('checked', false);
      }
      if (node.childNodes.length) {
        _ref = node.childNodes;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          _results.push(updateDisabled(child));
        }
        return _results;
      }
    };
    bomEl = document.getElementById('contextmenu_encodingUseBOM');
    if (lastEncodingPythonName != null) {
      lastEncoding = encodingSvc.get_encoding_info(lastEncodingPythonName);
    }
    if (lastEncoding != null) {
      updateChecked(encodingsMenu);
    } else {
      updateDisabled(encodingsMenu);
    }
    if (lastEncoding != null ? lastEncoding.byte_order_marker : void 0) {
      bomEl.removeAttribute('disabled');
      return bomEl.setAttribute('checked', lastEncodingUseBOM ? true : false);
    } else {
      bomEl.setAttribute('disabled', true);
      return bomEl.setAttribute('checked', false);
    }
  };
  $toolkit.statusbar.updateIndentationMenu = function() {
    var inList, indentationMenu, itemEl, levels, otherLevelEl, softTabsEl, _fn, _i, _j, _k, _len, _len2, _len3, _ref, _ref2, _results;
    indentationMenu = document.getElementById('statusbar-indentation-menu');
    if (!indentationBuilt) {
      _fn = function(levels) {
        var itemEl;
        itemEl = document.createElementNS(XUL_NS, 'menuitem');
        itemEl.setAttribute('class', 'statusbar-label');
        itemEl.setAttribute('id', "contextmenu_indentation" + levels);
        itemEl.setAttribute('name', 'current_indentation');
        itemEl.setAttribute('label', levels);
        itemEl.setAttribute('accesskey', levels);
        itemEl.setAttribute('type', 'checkbox');
        itemEl.setAttribute('data-indent', levels);
        itemEl.addEventListener('command', (function() {
          return $toolkit.statusbar.updateViewIndentation(levels);
        }), null);
        return indentationMenu.insertBefore(itemEl, indentationMenu.firstChild);
      };
      for (_i = 0, _len = indentationsList.length; _i < _len; _i++) {
        levels = indentationsList[_i];
        _fn(levels);
      }
      indentationBuilt = true;
    }
    if (lastIndentLevels != null) {
      inList = false;
      _ref = indentationMenu.childNodes;
      for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
        itemEl = _ref[_j];
        itemEl.removeAttribute('disabled');
        if ((levels = itemEl.getAttribute('data-indent')) != null) {
          itemEl.setAttribute('checked', Number(levels) === lastIndentLevels ? (inList = true) : false);
        }
      }
      otherLevelEl = document.getElementById('contextmenu_indentationOther');
      otherLevelEl.setAttribute('checked', inList ? false : true);
      softTabsEl = document.getElementById('contextmenu_indentationSoftTabs');
      return softTabsEl.setAttribute('checked', lastIndentHardTabs ? false : true);
    } else {
      _ref2 = indentationMenu.childNodes;
      _results = [];
      for (_k = 0, _len3 = _ref2.length; _k < _len3; _k++) {
        itemEl = _ref2[_k];
        itemEl.setAttribute('disabled', true);
        _results.push(itemEl.setAttribute('checked', false));
      }
      return _results;
    }
  };
  $toolkit.statusbar.showCustomIndentationPanel = function() {
    var panelEl, relativeEl, scaleEl, view;
    if (!(view = currentView())) {
      return;
    }
    scaleEl = document.getElementById('customIndentation_scale');
    scaleEl.setAttribute('value', lastIndentLevels);
    panelEl = document.getElementById('customIndentation_panel');
    relativeEl = document.getElementById('statusbarviewbox');
    return panelEl.openPopup(relativeEl, 'before_end', -document.getElementById('statusbar-language').boxObject.width - 10, 0);
  };
  $toolkit.statusbar.handleCustomIndentationPanelKey = function(event) {
    var panelEl, scaleEl, _ref;
    if ((_ref = event.keyCode) !== event.DOM_VK_ENTER && _ref !== event.DOM_VK_RETURN) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    scaleEl = document.getElementById('customIndentation_scale');
    panelEl = document.getElementById('customIndentation_panel');
    panelEl.hidePopup();
    return $toolkit.statusbar.updateViewIndentation(Number(scaleEl.getAttribute('value')));
  };
  $toolkit.statusbar.updateSoftTabs = function() {
    var softTabsEl;
    softTabsEl = document.getElementById('contextmenu_indentationSoftTabs');
    return $toolkit.statusbar.updateViewHardTabs(softTabsEl.getAttribute('checked') !== 'true');
  };
  $toolkit.trapExceptions($toolkit.statusbar);
}).call(this);
