import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

export default [

	// Browser-friendly UMD build, from the entry that only has the default
	// export, so that the global is the class itself
	{
		input: 'src/umd.js',
		output: {
			name: 'StarGraphicsPrinterEncoder',
			file: 'dist/star-graphics-printer-encoder.umd.js',
			sourcemap: true,
			exports: 'default',
			format: 'umd'
		},
		plugins: [
			resolve({ browser: true }),
			commonjs(),
			terser()
		]
	},

	// Browser-friendly ES module build
	{
		input: 'src/star-graphics-printer-encoder.js',
		output: {
			file: 'dist/star-graphics-printer-encoder.esm.js',
			sourcemap: true,
			exports: 'named',
			format: 'es'
		},
		plugins: [
			resolve({ browser: true }),
			commonjs(),
			terser()
		]
	},

	// CommonJS (for Node) and ES module (for bundlers) build
	{
		input: 'src/star-graphics-printer-encoder.js',
		output: [
			{ file: 'dist/star-graphics-printer-encoder.cjs', exports: 'named', format: 'cjs' },
			{ file: 'dist/star-graphics-printer-encoder.mjs', exports: 'named', format: 'es' }
		]
	},

	// Bundled TypeScript declarations
	{
		input: 'dist/tmp/star-graphics-printer-encoder.d.ts',
		output: {
			file: 'dist/star-graphics-printer-encoder.d.ts',
			format: 'es'
		},
		plugins: [
			dts()
		]
	}
];
