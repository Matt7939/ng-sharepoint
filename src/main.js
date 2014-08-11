function main($http, SP_CONFIG) {

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
			if (_config.peopleLookup.cache && _cachePeople[search]) {

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
					'cache'   : _config.peopleLookup.cache,
					'url'     : _config.pplURL,
					'params'  : {
						'$select': _config.peopleLookup.fields.toString(),
						'$filter': "startswith(" + _config.peopleLookup.searchField + ",'" + search + "')",
						'$top'   : _config.peopleLookup.limit
					}
				})

				// Now convert to an array, store a copy in the cache and return results of execFilter()
				.then(function (response) {

					      var data = _cachePeople[search] = _.toArray(response.data.d);
					      return execFilter(data);

				      });

		},

		/**
		 * Current user data parser
		 *
		 * Performs a page-scrape to find relevant user data (this is required for SP 2010 as the _api features aren't
		 * available).
		 *
		 * @param scope
		 * @param sBind
		 *
		 * @returns {*}
		 */
		'user': function (scope, sBind) {

			var scopeBinding = sBind || 'user',

			    data = localStorage.getItem('SP_REST_USER'),

			    cacheDays = _config.user.cache * CONST.JS_DAY;


			if (data && initStamp - data.updated < cacheDays) {

				data = JSON.parse(data);

				scope[scopeBinding] = data;

			} else {

				return $http(
					{
						'method': 'GET',
						'cache' : true,
						'url'   : _config.user.url
					})

					.then(function (response) {

						      var data, html;

						      data = {
							      'id'     : parseInt(response.data.match(/_spuserid=(\d+);/i)[1], 10),
							      'updated': new Date().getTime()
						      };

						      html = $(response.data.replace(/[ ]src=/g, ' data-src='));

						      html.find('#SPFieldText')
							      .each(function () {

								            var field1, field2;

								            field1 = this.innerHTML.match(/FieldName\=\"(.*)\"/i)[1];
								            field2 = this.innerHTML.match(/FieldInternalName\=\"(.*)\"/i)[1];

								            data[field1] = data[field2] = this.innerText.trim();

							            });

						      localStorage.SP_REST_USER = JSON.stringify(data);

						      scope[scopeBinding] = data;

					      });

			}

		},

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
		 * Create action
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
					}
				});

		},

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
						'params'  : opt.params || null,
						'headers' : {
							'DataServiceVersion': CONST.ODATA_VERSION
						}
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