/*
Holder.js - client side image placeholders
© 2012-2014 Ivan Malopinsky - http://imsky.co
*/
(function (register, global, undefined) {

	var Holder = {
		/**
		 * Adds a theme to default settings
		 *
		 * @param {string} name Theme name
		 * @param {Object} theme Theme object, with foreground, background, size, font, and fontweight properties.
		 */
		addTheme: function (name, theme) {
			name != null && theme != null && (App.settings.themes[name] = theme);
			delete App.vars.cache.themeKeys;
			return this;
		},

		/**
		 * Appends a placeholder to an element
		 *
		 * @param {string} src Placeholder URL string
		 * @param {string} el Selector of target element(s)
		 */
		addImage: function (src, el) {
			var node = document.querySelectorAll(el);
			if (node.length) {
				for (var i = 0, l = node.length; i < l; i++) {
					var img = document.createElement('img');
					img.setAttribute('data-src', src);
					node[i].appendChild(img);
				}
			}
			return this;
		},

		/**
		 * Runs Holder with options. By default runs Holder on all images with "holder.js" in their source attributes.
		 *
		 * @param {Object} preferences Options object, can contain domain, themes, images, and bgnodes properties
		 */
		run: function (userOptions) {
			var renderSettings = {};

			App.vars.preempted = true;

			var options = extend(App.settings, userOptions),
				images = [],
				bgnodes = [],
				stylenodes = [];

			//todo: validate renderer
			//todo: document runtime renderer option
			renderSettings.renderer = options.renderer ? options.renderer : App.setup.renderer;
			
			//< v2.4 API compatibility
			if (options.use_canvas) {
				renderSettings.renderer = 'canvas';
			} else if (options.use_svg) {
				renderSettings.renderer = 'svg';
			}

			images = getNodeArray(options.images);
			bgnodes = getNodeArray(options.bgnodes);
			stylenodes = getNodeArray(options.stylenodes);

			var backgroundImageRegex = new RegExp(options.domain + '\/(.*?)"?\\)');

			for (var i = 0; i < bgnodes.length; i++) {
				if(bgnodes[i].tagName.toLowerCase() == 'link') continue;
				var backgroundImage = global.getComputedStyle(bgnodes[i], null).getPropertyValue('background-image');
				var backgroundImageMatch = backgroundImage.match(backgroundImageRegex);
				var holderURL = null;
				if(backgroundImageMatch == null){
					//todo: document data-background-src
					var dataBackgroundImage = bgnodes[i].getAttribute('data-background-src');
					if(dataBackgroundImage != null){
						holderURL = dataBackgroundImage;
					}
				}
				else{
					holderURL = options.domain + '/' + backgroundImageMatch[1];
				}

				if(holderURL != null){
					var holderFlags = parseURL(holderURL, options);
					if(holderFlags){
						prepareDOMElement('background', bgnodes[i], holderFlags, holderURL, renderSettings);
					}
				}
			}

			for (i = 0; i < images.length; i++) {
				var attr_datasrc, attr_src, src;
				attr_src = attr_datasrc = src = null;
				var attr_rendered = null;

				var image = images[i];

				try {
					attr_src = image.getAttribute('src');
					attr_datasrc = image.getAttribute('data-src');
					attr_rendered = image.getAttribute('data-holder-rendered');
				} catch (e) {}

				var hasSrc = attr_src != null;
				var hasDataSrc = attr_datasrc != null;
				var hasDataSrcURL = hasDataSrc && attr_datasrc.indexOf(options.domain) === 0;
				var rendered = attr_rendered != null && attr_rendered == 'true';

				if (hasSrc) {
					if (attr_src.indexOf(options.domain) === 0) {
						prepareImageElement(options, renderSettings, attr_src, image);
					} else if (hasDataSrcURL) {
						if (rendered) {
							prepareImageElement(options, renderSettings, attr_datasrc, image);
						} else {
							//todo: simplify imageExists param marshalling so an object doesn't need to be created
							imageExists({
								src: attr_src,
								options: options,
								renderSettings: renderSettings,
								dataSrc: attr_datasrc,
								image: image
							}, function (exists, config) {
								if (!exists) {
									prepareImageElement(config.options, config.renderSettings, config.dataSrc, config.image);
								}
							});
						}
					}
				} else if (hasDataSrcURL) {
					prepareImageElement(options, renderSettings, attr_datasrc, image);
				}
			}
			return this;
		},
		
		//todo: document invisibleErrorFn for 2.4
		//todo: remove invisibleErrorFn for 2.5
		invisibleErrorFn: function (fn) {
			return function (el) {
				if (el.hasAttribute('data-holder-invisible')) {
					throw 'Holder: invisible placeholder';
				}
			};
		}
	};

	var App = {
		settings: {
			domain: 'holder.js',
			images: 'img',
			bgnodes: '.holderjs',
			stylenodes: 'link.holderjs',
			stylesheets: [],
			themes: {
				'gray': {
					background: '#EEEEEE',
					foreground: '#AAAAAA'
				},
				'social': {
					background: '#3a5a97',
					foreground: '#FFFFFF'
				},
				'industrial': {
					background: '#434A52',
					foreground: '#C2F200'
				},
				'sky': {
					background: '#0D8FDB',
					foreground: '#FFFFFF'
				},
				'vine': {
					background: '#39DBAC',
					foreground: '#1E292C',
				},
				'lava': {
					background: '#F8591A',
					foreground: '#1C2846',
					size: 12
				}
			}
		}
	};

	/**
	 * Processes provided source attribute and sets up the appropriate rendering workflow
	 *
	 * @private
	 * @param options Instance options from Holder.run
	 * @param renderSettings Instance configuration
	 * @param src Image URL
	 * @param el Image DOM element
	 */
	function prepareImageElement(options, renderSettings, src, el) {
		var holderFlags = parseURL(src.substr(src.lastIndexOf(options.domain)), options);

		if (holderFlags) {
			prepareDOMElement(holderFlags.fluid ? 'fluid' : 'image', el, holderFlags, src, renderSettings);
		}
	}

	/**
	 * Processes a Holder URL and extracts flags
	 *
	 * @private
	 * @param url URL
	 * @param options Instance options from Holder.run
	 */
	function parseURL(url, options) {
		var ret = {
			theme: extend(App.settings.themes.gray, null),
			stylesheets: options.stylesheets
		};
		var render = false;
		var flags = url.split('/');
		for (var fl = flags.length, j = 0; j < fl; j++) {
			var flag = flags[j];
			if (App.flags.dimensions.match(flag)) {
				render = true;
				ret.dimensions = App.flags.dimensions.output(flag);
			} else if (App.flags.fluid.match(flag)) {
				render = true;
				ret.dimensions = App.flags.fluid.output(flag);
				ret.fluid = true;
			} else if (App.flags.textmode.match(flag)) {
				ret.textmode = App.flags.textmode.output(flag);
			} else if (App.flags.colors.match(flag)) {
				var colors = App.flags.colors.output(flag);
				ret.theme = extend(ret.theme, colors);
			//todo: convert implicit theme use to a theme: flag
			} else if (options.themes[flag]) {
				//If a theme is specified, it will override custom colors
				if (options.themes.hasOwnProperty(flag)) {
					ret.theme = extend(options.themes[flag], null);
				}
			} else if (App.flags.font.match(flag)) {
				ret.font = App.flags.font.output(flag);
			} else if (App.flags.auto.match(flag)) {
				ret.auto = true;
			} else if (App.flags.text.match(flag)) {
				ret.text = App.flags.text.output(flag);
			} else if (App.flags.random.match(flag)) {
				if(App.vars.cache.themeKeys == null){
					App.vars.cache.themeKeys = Object.keys(options.themes);
				}
				var theme = App.vars.cache.themeKeys[0|Math.random()*App.vars.cache.themeKeys.length];
				ret.theme = extend(options.themes[theme], null);
			}
		}
		return render ? ret : false;
	}

	/**
	 * Modifies the DOM to fit placeholders and sets up resizable image callbacks (for fluid and automatically sized placeholders)
	 *
	 * @private
	 * @param mode Placeholder mode, either background or image
	 * @param el Image DOM element
	 * @param flags Placeholder-specific configuration
	 * @param src Image URL string
	 * @param renderSettings Instance configuration
	 */
	function prepareDOMElement(mode, el, flags, src, renderSettings) {
		var dimensions = flags.dimensions,
			theme = flags.theme,
			text = flags.text ? decodeURIComponent(flags.text) : flags.text;
		var dimensionsCaption = dimensions.width + 'x' + dimensions.height;

		var extensions = {};

		if(text){
			extensions.text = text;
		}
		if(flags.font){
			extensions.font = flags.font;
		}

		theme = extend(theme, extensions);

		if(mode == 'background'){
			if(el.getAttribute('data-background-src') == null){
				el.setAttribute('data-background-src', src);
			}
		}
		else{
			el.setAttribute('data-src', src);
		}

		flags.theme = theme;
		el.holderData = {
			flags: flags,
			renderSettings: renderSettings
		};

		if(mode == 'image' || mode == 'fluid'){
			el.setAttribute('alt', text ? text : theme.text ? theme.text + ' [' + dimensionsCaption + ']' : dimensionsCaption);
		}

		if (mode == 'image') {
			if (renderSettings.renderer == 'html' || !flags.auto) {
				el.style.width = dimensions.width + 'px';
				el.style.height = dimensions.height + 'px';
			}
			if (renderSettings.renderer == 'html') {
				el.style.backgroundColor = theme.background;
			} else {
				render(mode, {
					dimensions: dimensions,
					theme: theme,
					flags: flags
				}, el, renderSettings);

				if (flags.textmode && flags.textmode == 'exact') {
					App.vars.resizableImages.push(el);
					updateResizableElements(el);
				}
			}
		} else if (mode == 'background' && renderSettings.renderer != 'html') {
			render(mode, {
					dimensions: dimensions,
					theme: theme,
					flags: flags
				},
				el, renderSettings);
		} else if (mode == 'fluid') {
			if (dimensions.height.slice(-1) == '%') {
				el.style.height = dimensions.height;
			} else if (flags.auto == null || !flags.auto) {
				el.style.height = dimensions.height + 'px';
			}
			if (dimensions.width.slice(-1) == '%') {
				el.style.width = dimensions.width;
			} else if (flags.auto == null || !flags.auto) {
				el.style.width = dimensions.width + 'px';
			}
			if (el.style.display == 'inline' || el.style.display === '' || el.style.display == 'none') {
				el.style.display = 'block';
			}

			setInitialDimensions(el);

			if (renderSettings.renderer == 'html') {
				el.style.backgroundColor = theme.background;
			} else {
				App.vars.resizableImages.push(el);
				updateResizableElements(el);
			}
		}
	}

	/**
	 * Core function that takes output from renderers and sets it as the source or background-image of the target element
	 *
	 * @private
	 * @param mode Placeholder mode, either background or image
	 * @param params Placeholder-specific parameters
	 * @param el Image DOM element
	 * @param renderSettings Instance configuration
	 */

	function render(mode, params, el, renderSettings) {
		var image = null;

		//todo: move generation of scene up to flag generation to reduce extra object creation
		var scene = {
			width: params.dimensions.width,
			height: params.dimensions.height,
			theme: params.theme,
			flags: params.flags
		};

		var sceneGraph = buildSceneGraph(scene);

		var rendererParams = {
			text: scene.text,
			width: scene.width,
			height: scene.height,
			textHeight: scene.font.size,
			font: scene.font.family,
			fontWeight: scene.font.weight,
			template: scene.theme
		};

		switch(renderSettings.renderer){
			case 'canvas':
				image = sgCanvasRenderer(sceneGraph);
				//image = canvasRenderer(rendererParams);
			break;
			case 'svg':
				image = svgRenderer(rendererParams);
			break;
			default:
				throw 'Holder: invalid renderer: '+renderSettings.renderer;
		}

		if (image == null) {
			throw 'Holder: couldn\'t render placeholder';
		}

		if (mode == 'background') {
			el.style.backgroundImage = 'url(' + image + ')';
			el.style.backgroundSize = scene.width + 'px ' + scene.height + 'px';
		} else {
			el.setAttribute('src', image);
		}
		el.setAttribute('data-holder-rendered', true);
	}
	
	//todo: jsdoc buildSceneGraph
	function buildSceneGraph(scene){
		//todo: mark the placeholder for canvas re-render if font is defined
		scene.font = {
			family: scene.theme.font ? scene.theme.font : 'Arial, Helvetica, Open Sans, sans-serif',
			size: textSize(scene.width, scene.height, scene.theme.size ? scene.theme.size : 12),
			weight: scene.theme.fontweight ? scene.theme.fontweight : 'bold'
		};
		scene.text = scene.theme.text ? scene.theme.text : Math.floor(scene.width) + 'x' + Math.floor(scene.height);

		switch(scene.flags.textmode){
			case 'literal':
			scene.text = scene.flags.dimensions.width + 'x' + scene.flags.dimensions.height;
			break;
			case 'exact':
			if(!scene.flags.exactDimensions) break;
			scene.text = Math.floor(scene.flags.exactDimensions.width) + 'x' + Math.floor(scene.flags.exactDimensions.height);
			break;
		}
		
		var sceneGraph = new SceneGraph({
			width: scene.width,
			height: scene.height
		});

		var Shape = sceneGraph.Shape;

		var holderBg = new Shape.Rect('holderBg', {
			fill: scene.theme.background
		});

		holderBg.resize(scene.width, scene.height);
		sceneGraph.root.add(holderBg);

		var holderTextGroup = new Shape.Group('holderTextGroup', {
			text: scene.text,
			align: 'center',
			font: scene.font,
			fontSize: scene.font.size,
			fontWeight: scene.font.weight,
			fill: scene.theme.foreground
		});

		holderTextGroup.moveTo(null,null,1);
		sceneGraph.root.add(holderTextGroup);
		
		var tpdata = holderTextGroup.textPositionData = stagingRenderer(sceneGraph);

		if(tpdata.lineCount > 1){
			for(var i = 0; i < tpdata.words.length; i++){
				var word = tpdata.words[i];
			}
		}
		else{
			if(holderTextGroup.properties.align == 'center'){
				holderTextGroup.moveTo(
					(scene.width - tpdata.boundingBox.width) / 2,
					(scene.height - tpdata.boundingBox.height) / 2,
					null);
				var textNode = new Shape.Text(scene.text);
				holderTextGroup.add(textNode);
			}
		}

		//todo: renderlist

		return sceneGraph;
	}

	/**
	 * Adaptive text sizing function
	 *
	 * @private
	 * @param width Parent width
	 * @param height Parent height
	 * @param fontSize Requested text size
	 */
	function textSize(width, height, fontSize) {
		height = parseInt(height, 10);
		width = parseInt(width, 10);
		var bigSide = Math.max(height, width);
		var smallSide = Math.min(height, width);
		var scale = 1 / 12;
		var newHeight = Math.min(smallSide * 0.75, 0.75 * bigSide * scale);
		return Math.round(Math.max(fontSize, newHeight));
	}

	/**
	 * Iterates over resizable (fluid or auto) placeholders and renders them
	 *
	 * @private
	 * @param element Optional element selector, specified only if a specific element needs to be re-rendered
	 */
	function updateResizableElements(element) {
		var images;
		if (element == null || element.nodeType == null) {
			images = App.vars.resizableImages;
		} else {
			images = [element];
		}
		for (var i in images) {
			if (!images.hasOwnProperty(i)) {
				continue;
			}
			var el = images[i];
			if (el.holderData) {
				var flags = el.holderData.flags;
				var dimensions = dimensionCheck(el, Holder.invisibleErrorFn(updateResizableElements));
				if (dimensions) {
					if (flags.fluid && flags.auto) {
						var fluidConfig = el.holderData.fluidConfig;
						switch (fluidConfig.mode) {
						case 'width':
							dimensions.height = dimensions.width / fluidConfig.ratio;
							break;
						case 'height':
							dimensions.width = dimensions.height * fluidConfig.ratio;
							break;
						}
					}

					var drawParams = {
						dimensions: dimensions,
						theme: flags.theme,
						flags: flags
					};

					if (flags.textmode && flags.textmode == 'exact') {
						flags.exactDimensions = dimensions;
						drawParams.dimensions = flags.dimensions;
					}

					render('image', drawParams, el, el.holderData.renderSettings);
				}
			}
		}
	}

	/**
	 * Checks if an element is visible
	 *
	 * @private
	 * @param el DOM element
	 * @param callback Callback function executed if the element is invisible
	 */
	function dimensionCheck(el, callback) {
		var dimensions = {
			height: el.clientHeight,
			width: el.clientWidth
		};
		if (!dimensions.height && !dimensions.width) {
			el.setAttribute('data-holder-invisible', true);
			callback.call(this, el);
		} else {
			el.removeAttribute('data-holder-invisible');
			return dimensions;
		}
	}

	/**
	 * Sets up aspect ratio metadata for fluid placeholders, in order to preserve proportions when resizing
	 *
	 * @private
	 * @param el Image DOM element
	 */
	function setInitialDimensions(el) {
		if (el.holderData) {
			var dimensions = dimensionCheck(el, Holder.invisibleErrorFn(setInitialDimensions));
			if (dimensions) {
				var flags = el.holderData.flags;

				var fluidConfig = {
					fluidHeight: flags.dimensions.height.slice(-1) == '%',
					fluidWidth: flags.dimensions.width.slice(-1) == '%',
					mode: null,
					initialDimensions: dimensions
				};

				if (fluidConfig.fluidWidth && !fluidConfig.fluidHeight) {
					fluidConfig.mode = 'width';
					fluidConfig.ratio = fluidConfig.initialDimensions.width / parseFloat(flags.dimensions.height);
				} else if (!fluidConfig.fluidWidth && fluidConfig.fluidHeight) {
					fluidConfig.mode = 'height';
					fluidConfig.ratio = parseFloat(flags.dimensions.width) / fluidConfig.initialDimensions.height;
				}

				el.holderData.fluidConfig = fluidConfig;
			}
		}
	}

	var SVG_NS = 'http://www.w3.org/2000/svg';

	/**
	 * Generic SVG element creation function
	 *
	 * @private
	 * @param svg SVG context, set to null if new
	 * @param width Document width
	 * @param height Document height
	 */
	function initSVG(svg, width, height){
		if(svg == null){
			svg = document.createElementNS(SVG_NS, 'svg');
		}
		//IE throws an exception if this is set and Chrome requires it to be set
		if (svg.webkitMatchesSelector) {
			svg.setAttribute('xmlns', SVG_NS);
		}
		svg.setAttribute('width', width);
		svg.setAttribute('height', height);
		svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
		svg.setAttribute('preserveAspectRatio', 'none');
		return svg;
	}

	/**
	 * Generic SVG serialization function
	 *
	 * @private
	 * @param svg SVG context
	 * @param stylesheets CSS stylesheets to include
	 */
	function serializeSVG(svg, stylesheets){
		if (!global.XMLSerializer) return;
		var serializer = new XMLSerializer();
		/* todo: process stylesheets variable
		var xml = new DOMParser().parseFromString('<xml />', "application/xml")
		var css = xml.createProcessingInstruction('xml-stylesheet', 'href="http://netdna.bootstrapcdn.com/font-awesome/4.1.0/css/font-awesome.min.css" rel="stylesheet"');
		xml.insertBefore(css, xml.firstChild);
		xml.removeChild(xml.documentElement)
		var svg_css = serializer.serializeToString(xml);
		*/

		var svg_css = '';
		return svg_css + serializer.serializeToString(svg);
	}

	var stagingRenderer = (function(){
		var svg = null, stagingText = null, stagingTextNode = null;
		return function (graph){
			var rootNode = graph.root;
			if(App.setup.supportsSVG){
				var firstTimeSetup = false;
				var tnode = function(text){
						return document.createTextNode(text);
					};
				if(svg == null) {
					firstTimeSetup = true;
				}
				svg = initSVG(svg, rootNode.properties.width, rootNode.properties.height);
				if(firstTimeSetup){
					stagingText = document.createElementNS(SVG_NS, 'text');
					stagingTextNode = tnode(null);
					stagingText.setAttribute('x', 0);
					stagingText.appendChild(stagingTextNode);
					svg.appendChild(stagingText);
					document.body.appendChild(svg);
					svg.style.visibility = 'hidden';
					svg.style.position = 'absolute';
					svg.style.top = '0px';
					svg.style.left = '0px';
					svg.setAttribute('width', 0);
					svg.setAttribute('height', 0);
				}
				
				var holderTextGroup = rootNode.children.holderTextGroup;
				stagingText.setAttribute('y', holderTextGroup.properties.fontSize);
				stagingText.setAttribute('style', cssProps({
					'font-weight': holderTextGroup.properties.fontWeight,
					'font-size': holderTextGroup.properties.fontSize + 'px',
					'font-family': holderTextGroup.properties.font,
					'dominant-baseline': 'middle'
				}));

				//Get bounding box for the whole string (total width and height)
				stagingTextNode.nodeValue = holderTextGroup.properties.text;
				var stagingTextBBox = stagingText.getBBox();

				//Get line count and split the string into words
				var lineCount = Math.ceil(stagingTextBBox.width / rootNode.properties.width);
				var words = holderTextGroup.properties.text.split(' ');

				//Get bounding box for the string with spaces removed
				stagingTextNode.nodeValue = holderTextGroup.properties.text.replace(/[ ]+/g, '');
				var computedNoSpaceLength = stagingText.getComputedTextLength();

				//Compute average space width
				var diffLength = stagingTextBBox.width - computedNoSpaceLength;
				var spaceWidth = Math.round(diffLength / Math.max(1, words.length-1));

				//Get widths for every word with space only if there is more than one line
				var wordWidths = [];
				if(lineCount > 1){
					stagingTextNode.nodeValue = '';
					for(var i = 0; i < words.length; i++){
						stagingTextNode.nodeValue = words[i];
						var bbox = stagingText.getBBox();
						wordWidths.push({
							text: words[i],
							width: bbox.width
						});
					}
				}

				return {
					spaceWidth: spaceWidth,
					lineCount: lineCount,
					boundingBox: stagingTextBBox,
					words: wordWidths
				};
			}
			else{
				//todo: canvas fallback for measuring text on android 2.3
				return false;
			}
		};
	})();

	//todo: fix svg rendering on zoomed-in documents if possible

	var sgCanvasRenderer = (function () {
		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');

		return function (sceneGraph) {
			var root = sceneGraph.root;
			canvas.width = App.dpr(root.properties.width);
			canvas.height = App.dpr(root.properties.height);
			ctx.textBaseline = 'top';

			ctx.fillStyle = root.children.holderBg.properties.fill;
			ctx.fillRect(0, 0, App.dpr(root.children.holderBg.width), App.dpr(root.children.holderBg.height));
			
			var textGroup = root.children.holderTextGroup;
			ctx.font = textGroup.properties.fontWeight + ' '+App.dpr(textGroup.properties.font.size)+'px ' + textGroup.properties.font.family;
			ctx.fillStyle = textGroup.properties.fill;
			for(var nodeKey in textGroup.children){
				var textNode = textGroup.children[nodeKey];
				ctx.fillText(textNode.properties.text, App.dpr(textGroup.x + textNode.x), App.dpr(textGroup.y + textNode.y));
			}
			
			return canvas.toDataURL('image/png');
		};
	})();

	var canvasRenderer = (function () {
		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');

		return function (props) {
			var finalWidth = props.width * App.setup.ratio;
			var finalHeight = props.height * App.setup.ratio;
			
			canvas.width = finalWidth;
			canvas.height = finalHeight;

			ctx.fillStyle = props.template.background;
			ctx.fillRect(0, 0, finalWidth, finalHeight);

			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = props.fontWeight + ' ' + (props.textHeight * App.setup.ratio) + 'px ' + props.font;
			ctx.fillStyle = props.template.foreground;
			ctx.fillText(props.text, (finalWidth / 2), (finalHeight / 2));

			return canvas.toDataURL('image/png');
		};
	})();

	var svgRenderer = (function () {
		//Prevent IE <9 from initializing SVG renderer
		if (!global.XMLSerializer) return;
		var svg = initSVG(null, 0,0);

		var bg_el = document.createElementNS(SVG_NS, 'rect');
		var text_el = document.createElementNS(SVG_NS, 'text');
		var textnode_el = document.createTextNode(null);
		text_el.setAttribute('text-anchor', 'middle');
		text_el.appendChild(textnode_el);
		svg.appendChild(bg_el);
		svg.appendChild(text_el);
		
		return function (props) {
			if (isNaN(props.width) || isNaN(props.height) || isNaN(props.textHeight)) {
				throw 'Holder: incorrect properties passed to SVG constructor';
			}
			initSVG(svg, props.width, props.height);
			bg_el.setAttribute('width', props.width);
			bg_el.setAttribute('height', props.height);
			bg_el.setAttribute('fill', props.template.background);
			text_el.setAttribute('x', props.width / 2);
			text_el.setAttribute('y', props.height / 2);
			textnode_el.nodeValue = props.text;
			text_el.setAttribute('style', cssProps({
				'fill': props.template.foreground,
				'font-weight': props.fontWeight,
				'font-size': props.textHeight + 'px',
				'font-family': props.font,
				'dominant-baseline': 'central'
			}));
			
			return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(serializeSVG(svg, null))));
		};
	})();

	//Helpers

	/**
	 * Shallow object clone and merge
	 *
	 * @param a Object A
	 * @param b Object B
	 * @returns {Object} New object with all of A's properties, and all of B's properties, overwriting A's properties
	 */
	function extend(a, b) {
		var c = {};
		for (var x in a) {
			if (a.hasOwnProperty(x)) {
				c[x] = a[x];
			}
		}
		if(b != null){
			for (var y in b) {
				if (b.hasOwnProperty(y)) {
					c[y] = b[y];
				}
			}
		}
		return c;
	}

	/**
	 * Takes a k/v list of CSS properties and returns a rule
	 *
	 * @param props CSS properties object
	 */
	function cssProps(props) {
		var ret = [];
		for (var p in props) {
			if (props.hasOwnProperty(p)) {
				ret.push(p + ':' + props[p]);
			}
		}
		return ret.join(';');
	}

	/**
	 * Prevents a function from being called too often, waits until a timer elapses to call it again
	 *
	 * @param fn Function to call
	 */
	function debounce(fn) {
		if (!App.vars.debounceTimer) fn.call(this);
		if (App.vars.debounceTimer) clearTimeout(App.vars.debounceTimer);
		App.vars.debounceTimer = setTimeout(function () {
			App.vars.debounceTimer = null;
			fn.call(this);
		}, App.setup.debounce);
	}

	/**
	 * Holder-specific resize/orientation change callback, debounced to prevent excessive execution
	 */
	function resizeEvent() {
		debounce(function () {
			updateResizableElements(null);
		});
	}

	//todo: jsdoc getNodeArray
	function getNodeArray(val){
		var retval = null;
		if (typeof (val) == 'string') {
			retval = document.querySelectorAll(val);
		} else if (global.NodeList && val instanceof global.NodeList) {
			retval = val;
		} else if (global.Node && val instanceof global.Node) {
			retval = [val];
		} else if (global.HTMLCollection && val instanceof global.HTMLCollection) {
			retval = val;
		}
		return retval;
	}

	/**
	 * Checks if an image exists
	 *
	 * @param params Configuration object, must specify at least a src key
	 * @param callback Callback to call once image status has been found
	 */
	function imageExists(params, callback) {
		var image = new Image();
		image.onerror = function () {
			callback.call(this, false, params);
		};
		image.onload = function () {
			callback.call(this, true, params);
		};
		image.src = params.src;
	}

	// Scene graph

	var SceneGraph = function(sceneProperties) {
		var nodeCount = 1;

		//todo: move merge to helpers section
		function merge(parent, child){
			for(var prop in child){
				parent[prop] = child[prop];
			}
			return parent;
		}

		var changedNodes = {};

		//todo: move all change code out

		function addChangedNode(node){
			changedNodes[node.id] = node;
		}

		function flushChangedNodes(){
			var nodes = [];
			for(var i in changedNodes){
				if(changedNodes.hasOwnProperty(i)){
					nodes.push(changedNodes[i]);
				}
			}
			changedNodes = {};
			return nodes;
		}
		
		var SceneNode = augment.defclass({
			constructor: function(name){
				nodeCount++;
				this.parent = null;
				this.children = {};
				this.id = nodeCount;
				this.name = 'n' + nodeCount;
				if(name != null){
					this.name = name;
				}
				this.x = 0;
				this.y = 0;
				this.z = 0;
				this.width = 0;
				this.height = 0;
			},
			resize: function(width, height){
				if(width != null){
					this.width = width;
				}
				if(height != null){
					this.height = height;
				}
				//addChangedNode(this);
			},
			move: function(dx, dy, dz){
				this.x += dx;
				this.y += dy;
				this.z += dz;
				//addChangedNode(this);
			},
			moveTo: function(x, y, z){
				this.x = x != null ? x : this.x;
				this.y = y != null ? y : this.y;
				this.z = z != null ? z : this.z;
				//addChangedNode(this);
			},
			add: function(child){
				var name = child.name;
				if(this.children[name] == null){
					this.children[name] = child;
					child.parent = this;
				}
				else{
					throw 'SceneGraph: child with that name already exists: '+name;
				}
				//addChangedNode(this);
			},
			remove: function(name){
				if(this.children[name] == null){
					throw 'SceneGraph: child with that name doesn\'t exist: '+name;
				}
				else{
					child.parent = null;
					delete this.children[name];
				}
				//addChangedNode(this);
			},
			removeAll: function(){
				for(var child in this.children){
					this.remove(child);
				}
			}
		});

		var RootNode = augment(SceneNode, function(uber){
			this.constructor = function(){
				uber.constructor.call(this, 'root');
				this.properties = sceneProperties;
			};
		});

		var Shape = augment(SceneNode, function(uber){
			function constructor(name, props){
				uber.constructor.call(this, name);
				this.properties = {fill:'#000'};
				if(props != null){
					merge(this.properties, props);
				}
				else if(name != null && typeof name !== 'string'){
					throw 'SceneGraph: invalid node name';
				}
			}

			this.Group = augment.extend(this, {
				constructor: constructor,
				type: 'group'
			});

			this.Rect = augment.extend(this, {
				constructor: constructor,
				type: 'rect'
			});

			this.Text = augment.extend(this, {
				constructor: function(text){
					constructor.call(this);
					this.properties.text = text;
				},
				type: 'text'
			});
		});

		var root = new RootNode();

		this.Shape = Shape;
		this.root = root;
		this.flushChangedNodes = flushChangedNodes;

		return this;
	};

	//< v2.4 API compatibility

	Holder.add_theme = Holder.addTheme;
	Holder.add_image = Holder.addImage;
	Holder.invisible_error_fn = Holder.invisibleErrorFn;

	//Configuration

	App.flags = {
		dimensions: {
			regex: /^(\d+)x(\d+)$/,
			output: function (val) {
				var exec = this.regex.exec(val);
				return {
					width: +exec[1],
					height: +exec[2]
				};
			}
		},
		fluid: {
			regex: /^([0-9%]+)x([0-9%]+)$/,
			output: function (val) {
				var exec = this.regex.exec(val);
				return {
					width: exec[1],
					height: exec[2]
				};
			}
		},
		colors: {
			regex: /#([0-9a-f]{3,})\:#([0-9a-f]{3,})/i,
			output: function (val) {
				var exec = this.regex.exec(val);
				return {
					foreground: '#' + exec[2],
					background: '#' + exec[1]
				};
			}
		},
		text: {
			regex: /text\:(.*)/,
			output: function (val) {
				return this.regex.exec(val)[1];
			}
		},
		font: {
			regex: /font\:(.*)/,
			output: function (val) {
				return this.regex.exec(val)[1];
			}
		},
		auto: {
			regex: /^auto$/
		},
		textmode: {
			regex: /textmode\:(.*)/,
			output: function (val) {
				return this.regex.exec(val)[1];
			}
		},
		//todo: document random flag
		random: {
			regex: /^random$/
		}
	};

	for (var flag in App.flags) {
		if (!App.flags.hasOwnProperty(flag)) continue;
		App.flags[flag].match = function (val) {
			return val.match(this.regex);
		};
	}

	//Properties set once on setup

	App.setup = {
		renderer: 'html',
		debounce: 100,
		ratio: 1,
		supportsCanvas: false,
		supportsSVG: false
	};

	App.dpr = function(val){
		return val * App.setup.ratio;
	}

	//Properties modified during runtime

	App.vars = {
		preempted: false,
		resizableImages: [],
		debounceTimer: null,
		cache: {}
	};

	//Pre-flight

	(function () {
		var devicePixelRatio = 1,
			backingStoreRatio = 1;

		var canvas = document.createElement('canvas');
		var ctx = null;

		if (canvas.getContext) {
			if (canvas.toDataURL('image/png').indexOf('data:image/png') != -1) {
				App.setup.renderer = 'canvas';
				ctx = canvas.getContext('2d');
				App.setup.supportsCanvas = true;
			}
		}

		if (App.setup.supportsCanvas) {
			devicePixelRatio = global.devicePixelRatio || 1;
			backingStoreRatio = ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio || ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1;
		}

		App.setup.ratio = devicePixelRatio / backingStoreRatio;

		if (!!document.createElementNS && !!document.createElementNS(SVG_NS, 'svg').createSVGRect) {
			App.setup.renderer = 'svg';
			App.setup.supportsSVG = true;
		}
	})();

	//Exposing to environment and setting up listeners

	register(Holder, 'Holder', global);

	if (global.onDomReady) {
		global.onDomReady(function () {
			if (!App.vars.preempted) {
				Holder.run({});
			}
			if (global.addEventListener) {
				global.addEventListener('resize', resizeEvent, false);
				global.addEventListener('orientationchange', resizeEvent, false);
			} else {
				global.attachEvent('onresize', resizeEvent);
			}

			if (typeof global.Turbolinks == 'object') {
				global.document.addEventListener('page:change', function () {
					Holder.run({});
				});
			}
		});
	}

})(function (fn, name, global) {
	var isAMD = (typeof define === 'function' && define.amd);
	var isNode = (typeof exports === 'object');
	var isWeb = !isNode;

	if (isAMD) {
		define(fn);
	} else {
		//todo: npm/browserify registration
		global[name] = fn;
	}
}, this);
