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
