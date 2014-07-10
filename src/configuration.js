function configuration(SP_CONFIG) {

	// Constants for the service
	CONST = {

		// For caching, this is the initial timing offset (1 Jan 2014).  SP gives intermitten 500 errors if you use EPOCH
		'EPOCH_OFFSET'    : 1388552400,

		// The field name suffix for any JSON fields that will be automatically encoded/decoded by ng-sharepoint
		'FIELD_JSON_TRAIL': '_JSON',

		// For SP 2010 use 2.0 for 2013 it's 3.0.  This was added due to random 500 errors from a SP farm when this header wasn't sent (this is NOT required by the oData Spec)!
		'ODATA_VERSION'   : '2.0'

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

}