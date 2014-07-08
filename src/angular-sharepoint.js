/*global angular, db, _, PRODUCTION, FTSS */


angular

	.module('ngSharePoint', [])

	.factory(
	'SharePoint',

	['$http',
	 
	 'SP_CONFIG',

	 function ($http, SP_CONFIG) {

		 var _utils = {},

		     _debounce = {},

		     CONST = {

			     'EPOCH_OFFSET': 1388552400,

			     'FIELD_JSON_TRAIL': '_JSON',

			     'ODATA_VERSION': '2.0'

		     };


		 return api;

	 }
	]);
