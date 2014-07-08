var fs = require('fs');

exports.config = {

	'modules': {
		'wrapper'   : false,
		'definition': false
	},

	'paths': {
		'watched': ['src'],
		'public' : 'build'
	},

	'files': {

		'javascripts': {

			'joinTo': {
				'out.js'      : /^src/,
				'test/test.js': /^test/
			},

			'order': {
				'before': ['src/initialize.js',
				           'src/utils.js'
				]
			}
		}
	},

	'onCompile': function () {

		var output = 'build/ng-sharepoint.js',

		    files = ['src/prefix.txt',
		             'build/out.js',
		             'src/suffix.txt'
		    ];

		fs.writeFile(output, '', function () {

			while (files.length) {

				fs.appendFile(output, fs.readFileSync(files.shift()));

			}

			fs.unlinkSync('build/out.js');

		});

	}
};