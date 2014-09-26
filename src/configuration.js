function configuration(SP_CONFIG) {

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