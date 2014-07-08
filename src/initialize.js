/*global _, db, angular */

var _cache, _config, _utils, _debounce, CONST;

_debounce = {};

CONST = {

	'EPOCH_OFFSET': 1388552400,

	'FIELD_JSON_TRAIL': '_JSON',

	'ODATA_VERSION': '2.0'

};

_config = _.defaults(
	// Load the SP_CONFIG variable if it exists
		SP_CONFIG || {},

		{
			// The URL for ListData.svc, default: /_vti_bin/ListData.svc
			'baseURL'     : '/_vti_bin/ListData.svc/',

			// The URL for loading user data, default: /_layouts/userdisp.aspx?Force=True
			'userURL'     : '/_layouts/userdisp.aspx?Force=True',

			// The URL for loading SP users, default: /_vti_bin/ListData.svc/UserInformationList
			'pplURL'      : '/_vti_bin/ListData.svc/UserInformationList',

			// Enable offline mode, doesn't check for changes if data is already cached
			'offline'     : false,

			// Override all caching options (automatic if db isn't loaded)
			'noCache'     : !db || false,

			// User-defined value.  Changing this will force all users to flush/re-validate all caches, useful for schema changes
			'cacheVersion': 1
		});

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

angular

	.module('ngSharePoint', [])

	.factory('SharePoint',

             ['$http',
              'SP_CONFIG',
              main
             ]);
