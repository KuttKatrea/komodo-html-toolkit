$toolkit.include('events');
$toolkit.include('htmlUtils');
$toolkit.include('io');

const Cc = Components.classes;
const Ci = Components.interfaces;

const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

var PREVIEW_CACHED_TEMPLATES = {};

$self.destroy = function() {

	if ($self.dispatcher)
		$self.dispatcher.unregister();
};

$self.initialize = function() {

	$toolkit.events.onLoad($self.dispatcher.register);
};

$self.storage = new (function() {

	// Open a connection to our database
	var storageFile = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('ProfD', Ci.nsIFile),
		storageService = Cc['@mozilla.org/storage/service;1'].getService(Ci.mozIStorageService);

	storageFile.append('html_toolkit_preview.sqlite');

	/** @type  Components.interfaces.mozIStorageConnection */
	var dbConnection;

	try { dbConnection = storageService.openDatabase(storageFile); }
	catch (e) {

		// If the database was corrupted, remove it and start over
		if ('NS_ERROR_FILE_CORRUPTED' === e.name) {

			storageFile.remove(false);
			dbConnection = storageService.openDatabase(storageFile);

		} else
			throw e;
	}

	// Create tables if missing
	if ( ! dbConnection.tableExists('preview_options'))
		dbConnection.createTable('preview_options',
								 'id INTEGER NOT NULL PRIMARY KEY,\n'
							   + 'uri TEXT UNIQUE,\n'
							   + 'json_options TEXT,\n'
							   + 'timestamp INTEGER -- Unix time (local)\n');

	// Housekeeping, remove all items older than two weeks
	var timeNow = (function() { return Math.floor(new Date().getTime() / 1000); });

	/** @type  Components.interfaces.mozIStorageStatement */
	var cleanUpStatement = dbConnection.createStatement('DELETE FROM preview_options WHERE timestamp < ?1');

	cleanUpStatement.bindInt32Parameter(0, timeNow() - (2 * 7 * 24 * 60 * 60));
	cleanUpStatement.execute();
	cleanUpStatement.reset();

	/** @type  Components.interfaces.mozIStorageStatement */
	var insertStatement = dbConnection.createStatement('REPLACE INTO preview_options (uri, json_options, timestamp) VALUES (?1, ?2, ?3)');

	var cachedOptions = {},
		nativeJSON = Cc['@mozilla.org/dom/json;1'].createInstance(Ci.nsIJSON);

	// Restore options for database
	var selectStatement = dbConnection.createStatement('SELECT uri, json_options FROM preview_options');

	while (selectStatement.executeStep()) {

		var viewUri = selectStatement.getUTF8String(0),
			viewOptions = selectStatement.getUTF8String(1);

		cachedOptions['uri:' + viewUri] = nativeJSON.decode(viewOptions);
	}

	selectStatement.finalize();

	this.getViewUri = function(view) {

		if (view.koDoc.file)
			return view.koDoc.file.URI;

		return view.uid;
	};

	this.getOptionsForView = function(view) {
		return cachedOptions['uri:' + this.getViewUri(view)];
	};

	this.setOptionsForView = function(view, options) {

		cachedOptions['uri:' + this.getViewUri(view)] = options;
		this.saveOptionsForView(view, options);
	};

	this.saveOptionsForView = function(view, options) {

		insertStatement.bindUTF8StringParameter(0, this.getViewUri(view));
		insertStatement.bindUTF8StringParameter(1, nativeJSON.encode(options));
		insertStatement.bindInt32Parameter(2, timeNow())

		insertStatement.execute();
		insertStatement.reset();
	};

	$toolkit.events.onUnload(function() {

		// Finalize all statements
		insertStatement.finalize();
		cleanUpStatement.finalize();

		// Explicitly close our connection to the database
		dbConnection.close();
	});

})();

$self.dispatcher = {

	converters: [],

	// Cache these as used every 0.5 seconds
	osService: Cc['@activestate.com/koOs;1'].getService(Ci.koIOs),
	pathService: Cc['@activestate.com/koOsPath;1'].getService(Ci.koIOsPath),

	register: function() {

		// Listen for buffer changes
		window.addEventListener('current_view_changed', $self.dispatcher.onViewChanged, true);
		window.addEventListener('current_view_language_changed', $self.dispatcher.onViewChanged, true);
		window.addEventListener('view_closing', $self.dispatcher.onViewClosing, true);

		// Simulate 'view_changed' event on current view
		if (ko.views.manager.currentView)
			$self.dispatcher.onViewChanged({ originalTarget: ko.views.manager.currentView });
	},

	unregister: function() {

		// Remove all installed timers first
		$self.dispatcher.uninstallAll();

		// Unload all events on Komodo shutdown
		window.removeEventListener('current_view_changed', $self.dispatcher.onViewChanged, true);
		window.removeEventListener('current_view_language_changed', $self.dispatcher.onViewChanged, true);
		window.removeEventListener('view_closing', $self.dispatcher.onViewClosing, true);
	},

	addConverter: function(obj) {

		var index = $self.dispatcher.indexOfConverter(obj);
		if (index < 0) {

			$self.dispatcher.converters.push(obj);
			return $self.dispatcher.converters.length;
		}

		return index;
	},

	removeConverter: function(obj) {

		var index = $self.dispatcher.indexOfConverter(obj);
		if (index >= 0)
			return $self.dispatcher.converters.splice(index, 1);

		return null;
	},

	indexOfConverter: function(obj) {

		for (var index = 0; index < $self.dispatcher.converters.length; index ++)
			if ($self.dispatcher.converters[index] === obj)
				return index;

		return -1;
	},

	onViewChanged: function(e) {

		var view = e.originalTarget;
		if (view &&
			view.getAttribute('type') === 'editor' &&
			view.koDoc &&
			view.scimoz) {

			var installResult = $self.dispatcher.checkAndInstall(view);
			if ( ! installResult)
				$self.dispatcher.uninstallAll();

		} else
			$self.dispatcher.uninstallAll();
	},

	onViewClosing: function(e) {

		// Remove all custom XUL and timers before Komodo destroys the view
		var view = e.originalTarget;
		if (view && view.getAttribute('type') === 'editor')
			$self.dispatcher.uninstall(view);
	},

	checkAndInstall: function(view) {

		var converter;

		for (var i = 0; i < $self.dispatcher.converters.length; i ++) {

			converter = $self.dispatcher.converters[i];
			if (converter.language === view.koDoc.language) {

				if (view.__preview_installed)
					$self.dispatcher.replace(view, converter);
				else
					$self.dispatcher.install(view, converter);
				return true;
			}
		}

		$self.dispatcher.uninstall(view);
		return false;
	},

	install: function(view, converter) {
            alert('lol');

		if ( ! view.__preview_installed) {

			var splitterEl = document.createElementNS(XUL_NS, 'splitter'),
				grippyEl = document.createElementNS(XUL_NS, 'grippy'),
				boxEl = document.createElementNS(XUL_NS, 'vbox'),
				frameEl = document.createElementNS(XUL_NS, 'iframe');

			splitterEl.setAttribute('state', 'open');
			splitterEl.setAttribute('collapse', 'after');
			splitterEl.setAttribute('collapse', 'after');

			boxEl.setAttribute('flex', 1);

			frameEl.setAttribute('flex', 1);
			frameEl.setAttribute('src', 'about:blank');

			var viewOptions = $self.storage.getOptionsForView(view);
			if (viewOptions) {

				if (viewOptions.width.length > 0) {

					boxEl.setAttribute('width', viewOptions.width);
					boxEl.setAttribute('flex', 0);

				} else
					boxEl.setAttribute('flex', 1);

				splitterEl.setAttribute('state', viewOptions.state);
			}

			splitterEl.appendChild(grippyEl);
			boxEl.appendChild(frameEl);
			view.parentNode.appendChild(splitterEl);
			view.parentNode.appendChild(boxEl);

			boxEl.__preview_frame = frameEl;
			view.__preview_box = boxEl;
			view.__preview_splitter = splitterEl;
			view.__preview_text = null;
			view.__preview_conveter = converter;
			view.__preview_installed = true;

			$self.dispatcher.beginPeriodicalPreview(view);
		}
	},

	replace: function(view, converter) {

		if (view.__preview_installed) {

			$self.dispatcher.uninstall(view);
			$self.dispatcher.install(view, converter);
		}
	},

	uninstall: function(view) {

		if (view.__preview_installed) {

			$self.storage.setOptionsForView(view, { state: view['__preview_splitter'].getAttribute('state'),
													width: view['__preview_box'].width });

			$self.dispatcher.endPeriodicalPreview(view);

			view.__preview_box.parentNode.removeChild(view.__preview_splitter);
			view.__preview_box.parentNode.removeChild(view.__preview_box);

			delete view['__preview_splitter'];
			delete view['__preview_box'];
			delete view['__preview_text'];
			delete view['__preview_conveter'];
			delete view['__preview_installed'];
		}
	},

	uninstallAll: function() {

		var editorViews = ko.views.manager.topView.getViewsByType(true, 'editor');
		for (var i = 0; i < editorViews.length; i ++)
			$self.dispatcher.uninstall(editorViews[i]);
	},

	beginPeriodicalPreview: function(view) {

		if ( ! view.__preview_intervalId) {

			// Preview every 0.5 seconds
			view.__preview_intervalId = window.setInterval(function() {

				if (view.scimoz.isFocused || view.scimoz.focus)
					$self.dispatcher.displayPreview(view);

			}, view.__preview_conveter.interval);
		}
	},

	endPeriodicalPreview: function(view) {

		if (view.__preview_intervalId) {

			window.clearInterval(view.__preview_intervalId);
			delete view['__preview_intervalId'];
		}
	},

	displayPreview: function(view) {

		if (view.__preview_text === view.scimoz.text)
		 	return false;

		var allowedLength = view.__preview_conveter.allowedLength;
		if (view.scimoz.text.length > allowedLength) {

			$self.dispatcher.renderTemplate(view, 'exception', { exception: $toolkit.l10n('module').formatStringFromName('preview.overAllowedLength', [allowedLength], 1) });
			view.__preview_text = view.scimoz.text;

			return false;
		}

		try {

			var viewPath = '';

			if ($self.dispatcher.pathService.isfile(view.koDoc.displayPath))
				viewPath = 'file://' + $self.dispatcher.pathService.dirname(view.koDoc.displayPath) + $self.dispatcher.osService.sep;
			else
				viewPath = 'file://' + $self.dispatcher.osService.getcwd() + $self.dispatcher.osService.sep;

			var htmlCode = view.__preview_conveter.callback(view.scimoz.text);

			$self.dispatcher.renderTemplate(view, 'page', { html: htmlCode, base: viewPath });
			view.__preview_text = view.scimoz.text;

			return true;

		} catch (e) {

			$self.dispatcher.renderTemplate(view, 'exception', { exception: e });
		}

		return false;
	},

	getCachedTemplate: function(name) {

		var templateKey = '$tpl:' + name;

		if (templateKey in PREVIEW_CACHED_TEMPLATES)
			return PREVIEW_CACHED_TEMPLATES[templateKey];

		// Allow templates to be localised
		var localeService = Cc['@mozilla.org/intl/nslocaleservice;1'].getService(Ci.nsILocaleService),
			applicationLocale = localeService.getApplicationLocale().getCategory('NSILOCALE_CTYPE'),
			templateLocales = [applicationLocale, 'en-US'];

		templateLocales.forEach(function(locale) {

			if (PREVIEW_CACHED_TEMPLATES[templateKey])
				return false;

			try {

				var templatePath = 'locale/' + locale + '/command/preview/' + name + '.html',
					templateFile = $toolkit.io.getRelativeURI(templatePath, true);

				PREVIEW_CACHED_TEMPLATES[templateKey] = $toolkit.io.readEntireFile(templateFile);

			} catch (e) {}

			return true;
		});

		return PREVIEW_CACHED_TEMPLATES[templateKey];
	},

	renderTemplate: function(view, name, args) {

		var template = $self.dispatcher.getCachedTemplate(name);

		if (args)
			for (var key in args)
				if (args.hasOwnProperty(key)) {

					template = template.replace('${' + key + ':safe}', args[key], 'g')
									   .replace('${' + key + '}', $toolkit.htmlUtils.escape(args[key]), 'g');
				}

		var previewElement = view.__preview_box.__preview_frame;

		var updateHTML = function(e) {

			previewElement.contentDocument.koDocElement.innerHTML = template;

			// If an Event object was passed in, unregister event handler
			if (e)
				previewElement.removeEventListener('load', updateHTML, true);
		};

		// If the User has navigated away, restore original location to prevent security errors
		if (previewElement.contentWindow.location.href === 'about:blank')
			updateHTML();
		else {

			previewElement.addEventListener('load', updateHTML, true);
			previewElement.contentWindow.location.replace('about:blank');
		}
	}
};

$toolkit.trapExceptions($self.dispatcher);

$self.controller = function(language, interval, allowedLength, callback) {

	this.language = language;
	this.interval = (interval || 500);
	this.allowedLength = (allowedLength || 640 /* lines */ * 80 /* chars per column */);
	this.callback = (callback || function(text) { return text; });

	this.register = function() { $self.dispatcher.addConverter(this); };

	this.unregister = function() { $self.dispatcher.removeConverter(this); };
};

$self.registerAll = function() {

	$toolkit.registerAll(__namespace__);
};
