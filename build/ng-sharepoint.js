/**
 * Angular SharePoint
 *
 * An AngularJS module for interacting with Microsoft SharePoint's oData REST API
 *
 * (c) 2014 Jeff McCoy, http://jeffm.us
 *
 * License: MIT
 */

(function(window, angular, undefined) {

/*global _, db, angular */

var _cache, _config, _utils, _debounce, CONST;

// When caching is enabled, this variable stores references to queries to limit how fast a call can occur
_debounce = {};

/** Define the ngSharePoint module and SharePoint service
 *
 * An optional SP_CONFIG variable can be set to pass configuration options to the service:
 *
 *
 */
angular

	.module('ngSharePoint', [])

	.factory('SharePoint',

             ['$http',
              'SP_CONFIG',

              function ($http, SP_CONFIG) {

	              configuration(SP_CONFIG);

	              cache();

	              return main.apply(this, arguments);

              }
             ]);

/*global _utils, angular */


_utils = {

	/**
	 * Generate a timestamp offset from 1 Jan 2014 (EPOCH was too large and causing SP to throw a 500 error) :-/
	 *
	 * @returns {number} timestamp
	 */
	'getTimeStamp': function () {
		return Math.floor(new Date().getTime() / 1000 - CONST.EPOCH_OFFSET);
	},

	/**
	 * Performs object cleanup prior to sending to SharePoint to prevent 500 errors
	 *
	 * @param scope
	 * @returns {*}
	 */
	'beforeSend': function (scope) {

		var scopeClone = angular.copy(scope);

		// Empty the debounce list to prevent etag issues if the user is a really fast clicker!
		_debounce = {};

		// Add the timestamp if this is a cached request
		if (scopeClone.cache) {
			scopeClone.Timestamp = _utils.getTimeStamp();
		}

		// Remove non-model properties to prevent needless transmission/SP errors
		delete scopeClone.__metadata;
		delete scopeClone.callback;
		delete scopeClone.cache;

		// JSON-encode any fields with the FIELD_JSON_TRAIL value
		_(scopeClone).each(function (s, field) {

			if (field.indexOf(CONST.FIELD_JSON_TRAIL) > 0) {
				scopeClone[field] = s !== null ? JSON.stringify(s) : '';
			}

		});

		return scopeClone;
	},

	/**
	 * Helper utility to convert SharePoint date strings to Date() objects with caching
	 */
	'getDate': (function () {

		var dCache = {};

		return function (date) {

			if (date && !dCache[date]) {

				dCache[date] = Number(date.replace(/[^\d.]/g, ''));

			}

			return date ? new Date(dCache[date]) : null;

		};

	}()),

	/**
	 * Creates a sanitized string for our cache key
	 * @param options
	 * @returns {*}
	 */
	'cacheString': function (options) {

		// Remove all the junk from our JSON string of the model
		return JSON.stringify(options).replace(/[^\w]/gi, '') + _config.cacheVersion

	},

	'xmlToJSON': function (xml, tag) {

		var data = [];

		xml = angular.element(xml).find(tag);

		xml.each(function(key, element) {

			var row = {};

			_(element.attributes).each(function (prop) {
				row[prop.name] = prop.value;
			});

			if (xml.length > 1) {

				data.push(row);

			} else {

				data = row;

			}

		});



		return data;

	}

};

function cache() {

	// If caching is enabled/available set it up
	if (!_config.noCache) {

		// Array to hold our callbacks while the cache DB is still loading, this will change to the cacheDB after init
		_cache = [];

		db

			// Initialize the service
			.open(
			{
				'server' : 'angularSharePoint',
				'version': 1,
				'schema' : {
					'caches': {
						'keyPath': 'q'
					}
				}
			})

			// Once the DB is loaded, try to run any cached callbacks and setup the cacheDB reference
			.done(function (instance) {

				      // Clone the _cache array to runners[]
				      var runners = _cache.slice(0);

				      // Remap _cache to instance (now acts as the cacheDB)
				      _cache = instance;

				      // Run all the callbacks async
				      while (runners.length) {

					      // Use shift() to reduce the array and pass a callback
					      setTimeout(runners.shift(), 25);

				      }

			      });

	}

}
;function configuration(SP_CONFIG) {

	// Constants for the service
	CONST = {

		// MS in a day,
		'JS_DAY'          : 86400000,

		// For caching, this is the initial timing offset (1 Jan 2014).  SP gives intermitten 500 errors if you use EPOCH
		'EPOCH_OFFSET'    : 1388552400,

		// The field name suffix for any JSON fields that will be automatically encoded/decoded by ng-sharepoint
		'FIELD_JSON_TRAIL': '_JSON',

		// For SP 2010 use 2.0 for 2013 it's 3.0.  This was added due to random 500 errors from a SP farm when this header wasn't sent (this is NOT required by the oData Spec)!
		'ODATA_VERSION'   : '2.0',

		'SOAP': {

			'userinfo': '<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><GetCurrentUserInfo xmlns="http://schemas.microsoft.com/sharepoint/soap/directory/" /></soap12:Body></soap12:Envelope>',

			'groups': '<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><GetGroupCollectionFromUser xmlns="http://schemas.microsoft.com/sharepoint/soap/directory/"><userLoginName>_USER_</userLoginName></GetGroupCollectionFromUser></soap12:Body></soap12:Envelope>'

		}


	};

	_config = _.defaults(
		// Load the SP_CONFIG variable if it exists
			SP_CONFIG || {},

			{
				// The URL for ListData.svc, default: /_vti_bin/ListData.svc
				'baseURL': '/_vti_bin/ListData.svc/',

				'people': {

					// The URL for loading SP users, default: /_vti_bin/ListData.svc/UserInformationList
					'url': '/_vti_bin/ListData.svc/UserInformationList',

					'fields': 'Name,WorkEMail',

					'searchField': 'WorkEMail',

					'limit': 10,

					'cache': true

				},

				'user'        : {

					// The URL for loading user data, default: /_vti_bin/UserGroup.asmx
					'url'  : '/_vti_bin/UserGroup.asmx',

					// Determines whether user groups are loaded when user data is requested or not
					'groups': true

				},

				// Enable offline mode, doesn't check for changes if data is already cached
				'offline'     : false,

				// Override all caching options (automatic if db isn't loaded)
				'noCache'     : !db || false,

				// User-defined value.  Changing this will force all users to flush/re-validate all caches, useful for schema changes
				'cacheVersion': 1
			});

}
;function main($http, SP_CONFIG) {

	// This is the cache of our people queries
	var _cachePeople = {},

	    // The initial timestamp
	    initStamp = new Date().getTime();

	return {

		/**
		 * UserInformationList lookup
		 *
		 * This function performs a people lookup function that includes result caching and a filtering function.
		 *
		 * @param {String} search - The terms to query SharePoint by (using startswith function).
		 * @param {Function} [filter] - An optional filter function to apply to the result set.
		 *
		 * @returns {Array} The array of filtered people found.
		 */
		'people': function (search, filter) {

			// Call the filter independently because it may be change while the SP data shouldn't
			var execFilter = function (data) {

				return filter ? _.filter(data, function (d) {

					return filter(d);

				}) : data;

			};

			// If we've already done this search during the app's lifecycle, return it instead
			if (_config.people.cache && _cachePeople[search]) {

				return {
					'then': function (callback) {
						callback(execFilter(_cachePeople[search]));
					}
				};

			}

			// No cache existed so make the SP query
			return $http(
				{
					'dataType': 'json',
					'method'  : 'GET',
					'cache'   : _config.people.cache,
					'url'     : _config.people.url,
					'params'  : {
						'$select': _config.people.fields.toString(),
						'$filter': "startswith(" + _config.people.searchField + ",'" + search + "')",
						'$top'   : _config.people.limit
					}
				})

				// Now convert to an array, store a copy in the cache and return results of execFilter()
				.then(function (response) {

					      var data = _cachePeople[search] = _.toArray(response.data.d);
					      return execFilter(data);

				      });

		},

		/**
		 * Load user data and group membership
		 *
		 * Generates a SOAP request for the user data information including the groups the member is a part of if enabled
		 *
		 *
		 * @param scope
		 * @param sBind
		 *
		 * @returns {*}
		 */
		'user': (function () {

			var user;

			// We will keep this data persistent throughout the session to prevent excess page loads
			return function (scope, sBind) {

				var bind = function () {

					    scope[sBind || 'user'] = user;

				    },

				    params = {
					    'method' : 'POST',
					    'url'    : _config.user.url,
					    'headers': {
						    'Content-Type': 'application/soap+xml; charset=utf-8'
					    },
					    data     : CONST.SOAP.userinfo
				    };

				return user || $http(params)

					.then(function (response) {

						      user = _utils.xmlToJSON(response.data, 'user');

						      params.data = CONST.SOAP.groups.replace('_USER_', user.loginname);

						      bind();

						      return $http(params).then(function (response) {

							      user.groups = _utils.xmlToJSON(response.data, 'group');

						      });

					      });

			};

		}()),

		/**
		 * Execute SQL transaction
		 *
		 * Perform chained sequence of operations
		 *
		 * @param collection
		 * @returns {*}
		 */
		'batch': function (collection) {

			var map = [],

			    requests = _.map(collection, function (data) {

				    map.push(data);

				    return (data.__metadata.etag ?

				            [
						            'MERGE ' + data.__metadata.uri + ' HTTP/1.1',
						            'If-Match: ' + data.__metadata.etag

				            ] : ['POST ' + data.__metadata + ' HTTP/1.1'])

					    .concat(
					    [
						    'Content-Type: application/json;charset=utf-8',
						    'Accept: application/json',
						    '',
						    JSON.stringify(_utils.beforeSend(data))
					    ])

					    .join('\n');


			    }),

			    // Generate a random string used for our multipart boundaries
			    seed = Math.random().toString(36).substring(2),

			    // Generate the boundary for this transaction set
			    boundary = 'b_' + seed,

			    // Generate the changeset that will separate each individual action
			    changeset = 'c_' + seed,

			    // The header that appears before each action(must have the extra linebreaks or SP will die)
			    header = [
				    '',
				    '--' + changeset,
				    'Content-Type: application/http',
				    'Content-Transfer-Encoding: binary',
				    '',
				    ''
			    ].join('\n'),

			    // Create the body of the request with lots of linebreaks to make SP not sad.....
			    body = [

				    // Body start
					    '--' + boundary,

				    // Content type & changeset declaration
					    'Content-Type: multipart/mixed; boundary=' + changeset,

				    // Prepend a header to each request
					    header + requests.join(header),

				    // Another mandatory linebreak for SP
					    '',

				    // Close the changeset out
					    '--' + changeset + '--',

				    // Close the boundary as well
					    '--' + boundary + '--'

			    ].join('\n');

			// Call $http against $batch with the mulitpart/mixed content type & our body
			return $http(
				{
					'method' : 'POST',
					'url'    : _config.baseURL + '$batch',
					'headers': {
						'Content-Type'      : 'multipart/mixed; boundary=' + boundary,
						'DataServiceVersion': CONST.ODATA_VERSION
					},
					data     : body
				})

				.then(function (response) {

					      var index = 0,

					          data = response.data,

					          processed = data.split(data.match(/boundary=([\w-]+)/)[1]),

					          retVal = {

						          'success': true,

						          'transaction': {
							          'sent'    : response.config.data,
							          'received': data
						          }

					          };

					      processed = processed.slice(2, processed.length - 1);

					      _(processed).each(function (row) {

						      var callback = map[index++].callback,

						          etag = row.match(/ETag\:\s(.+)/i),

						          json;

						      if (retVal.success) {

							      retVal.success = (row.indexOf('HTTP/1.1 201') > 0) ||
							                       (row.indexOf('HTTP/1.1 204') > 0);

							      try {
								      json = JSON.parse(row.split(etag[0])[1].replace(/--$/, '')).d;
							      } catch (e) {
								      json = false;
							      }

							      callback && callback(
								      {
									      'etag': etag[1],
									      'data': json
								      });

						      }

					      });

					      return retVal;

				      });


		},

		/**
		 * Create data
		 *
		 * Performs a CREATE with the given scope variable, The scope
		 *
		 * @param {Object} scope
		 * @returns {*}
		 */
		'create': function (scope) {

			return $http(
				{
					'method' : 'POST',
					'url'    : _config.baseURL + (scope.__metadata.uri || scope.__metadata),
					'headers': {
						'DataServiceVersion': CONST.ODATA_VERSION
					},
					'data'   : _utils.beforeSend(scope)
				});

		},

		/**
		 * Updated data
		 *
		 * @param scope
		 * @returns {*}
		 */
		'update': function (scope) {

			return $http(
				{
					'method' : 'POST',
					'url'    : scope.__metadata.uri,
					'headers': {
						'If-Match'          : scope.__metadata.etag,
						'X-HTTP-Method'     : 'MERGE',
						'DataServiceVersion': CONST.ODATA_VERSION
					},
					'data'   : _utils.beforeSend(scope)
				});

		},

		/**
		 * Read Data
		 *
		 * @param optOriginal
		 * @returns {*|Promise}
		 */
		'read': function (optOriginal) {

			var getData, getCache, options;

			options = angular.copy(optOriginal);

			// clear empty filters before we get started
			if (options.params && _.isEmpty(options.params.$filter)) {
				delete options.params.$filter;
			}

			/**
			 * getData $http wrapper, wraps the $http service with some SP-specific garbage
			 *
			 * @param opt Object
			 * @returns {*|Promise}
			 */
			getData = function (opt) {

				// Join the params list if it is an array
				_(opt.params).each(function (param, key) {

					// Does nothing for Strings but for Arrays is equivalent to [].join(',')
					opt.params[key] = param.toString();

					// If this is a $select field and Id isn't specified, we'll need to add it for caching
					if (key === '$select' && param.indexOf('Id') < 0) {
						opt.params.$select += ',Id';
					}

				});

				return $http(
					{
						'dataType': 'json',
						'method'  : 'GET',
						'url'     : _config.baseURL + opt.source,
						'headers' : {
							'DataServiceVersion': CONST.ODATA_VERSION
						},
						'params'  : opt.params || null
					})

					.then(function (response) {

						      var i = 0,

						          data = response.data.d.results || response.data.d,

						          decoder,

						          json = [],

						          dateWalk = function (item) {
							          _(item).each(function (el, index, parent) {
								          if (typeof el === 'object' || typeof el === 'array') {

									          return dateWalk(el);

								          } else {

									          if (typeof el === 'string' && el.indexOf('/Date(') > -1) {

										          parent[index] = _utils.getDate(el);

									          }
								          }
							          })
						          };

						      if (data.length) {

							      _(data[0]).each(function (d, f) {

								      if (f.indexOf(CONST.FIELD_JSON_TRAIL) > 1) {
									      json.push(f);
								      }

							      });

							      decoder = function (v) {

								      if (json.length) {
									      _(json).each(function (field) {

										      v[field] = JSON.parse(v[field]);

									      });
								      }

								      dateWalk(v);

								      return v;

							      };

							      return _.reduce(data, function (o, v) {
								      o[v.Id || i++] = decoder(v);
								      return o;
							      }, {});

						      }

						      return data;

					      });

			};

			/**
			 * getCache custom cache resolver/awesomeness generator
			 * This will attempt to read indexerdb for any previously cached data and merge
			 * updates with the cache.
			 *
			 * YOU MUST HAVE A SP FIELD NUMBER FIELD NAMED "Timestamp" FOR THIS TO WORK
			 *
			 * The Modified field WOULD have been perfect if SP oData requests filtered times properly :-/
			 *
			 * @param callback
			 */
			getCache = function (callback) {

				// Load the cached data, if it doesn't actually exist we'll deal with it later on
				var runner = function () {

					// Create a cache key based on the model
					var cacheString = _utils.cacheString(options);

					_cache.caches.get(cacheString).done(function (cachedData, opts, hasCache, oldStamp) {

						cachedData = cachedData || {'json': {}, 'time': false};

						// Offline enabled and the item exists, just return it without checking SP
						if (_config.offline && cachedData.time) {

							callback(cachedData.json);
							return;

						}

						// Really make this a boolean
						hasCache = !!cachedData.time;

						// Save a copy of the old timestamp
						oldStamp = cachedData.time;

						// Set a new timestamp before our network call (so we don't miss anything)
						cachedData.time = _utils.getTimeStamp();

						// If we already have cached data we need to add the timestamp to the filter
						if (hasCache) {

							// This is a messy comparison to see if we're under the debounce threshold
							if (_debounce[cacheString] &&

							    cachedData.time -
							    _debounce[cacheString] <
							    (options.debounce || 15)

								) {

								callback(cachedData.json);
								return;

							}

							// Lazy man's deep object clone
							opts = JSON.parse(JSON.stringify(options));

							// Start the filter with the timestamp--just in case SP is being dumb (optimization)
							opts.params.$filter = '(Timestamp gt ' + oldStamp + ')' +

							                      (opts.params.$filter ?
							                       ' and ' + opts.params.$filter : '');

						}

						// Add the last cachedData.time variable to our _debounce array
						_debounce[cacheString] = cachedData.time;

						// Call getData() with the custom opts or options as applicable
						getData(opts || options)

							.then(function (data) {

								      // There was some data so we can add that to our cache and update everything
								      if (!_.isEmpty(data)) {

									      // Merge our updates with the cache
									      _(data).each(function (row, key) {
										      cachedData.json[key] = row;
									      });

									      // Fire & forget--just add this and keep going
									      _cache.caches.update(
										      {
											      'item': cachedData,
											      'key' : cacheString
										      });

									      if (hasCache) {

										      // Add an updated=true property to our response
										      _(data).each(function (row, key) {
											      cachedData.json[key].updated = true;
										      });

									      }

								      }

								      // All done, do the callback
								      callback(cachedData.json);

							      });

					});

				};

				// Que up the requests if the _cache DB isn't loaded yet
				if (typeof _cache.length === 'number') {
					_cache.push(runner);
				} else {
					runner();
				}

			};

			// If caching is disabled for the service, then override the request
			if (_config.noCache) {
				options.cache = false;
			}

			// Return the getData or getCache promises
			return !options.cache ?

				// Return getData()'s $http promises, no caching
				   getData(options) :

				// Return getCache()'s custom promises, caching is enabled
				   {

					   'then'   : getCache,
					   'catch'  : function () {
					   },
					   'finally': function () {
					   }

				   };
		}

	}

}
;
//# sourceMappingURL=out.js.map

}(window, window.angular));
