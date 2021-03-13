/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

 import {
	FileLoader,
	Loader,
	Mesh,
	Vector2,
	Vector3,
	Face3,
	Matrix4,
	Vector4,
	MathUtils,
	MeshPhongMaterial,
	Geometry,
	Quaternion,
	Plane,
	Shape,
	ShapeGeometry,
	TextureLoader,
	RepeatWrapping,
	FrontSide,
	DoubleSide,
	ImageBitmapLoader,
	Texture,
	Group,
} from 'three';

var RWXLoader = ( function () {

	const LightSampling = {
		FACET: 1,
		VERTEX: 2
	};

	const GeometrySampling = {
		POINTCOULD: 1,
		WIREFRAME: 2,
		SOLID: 3
	};

	const TextureMode = {
		LIT: 1,
		FORESHORTEN: 2,
		FILTER: 3
	};

	const MaterialMode = {
		NONE: 0,
		NULL: 1,
		DOUBLE: 2
	};

	var getFinalTransform = function ( ctx ) {

		var transform = new Matrix4();

		ctx.transformStack.forEach( ( t ) => {

			transform.multiply( t );

		} );

		return transform.multiply( ctx.currentTransform );

	};

	var triangulateFacesWithShapes = ( function () {

		// Mostly crediting @neeh for their answer: https://stackoverflow.com/a/42402681
		var _ctr = new Vector3();

		var _plane = new Plane();
		var _q = new Quaternion();
		var _y = new Vector3();
		var _x = new Vector3();

		var X = new Vector3( 1.0, 0.0, 0.0 );
		var Y = new Vector3( 0.0, 1.0, 0.0 );
		var Z = new Vector3( 0.0, 0.0, 1.0 );

		var _tmp = new Vector3();

		var _basis = new Matrix4();

		return function ( vertices, uvs, loop, materialID ) {

			var newVertices = [];
			var newUvs = [];
			var faces = [];

			var offset = vertices.length;

			// compute centroid
			_ctr.setScalar( 0.0 );

			var l = loop.length;
			for ( var i = 0; i < l; i ++ ) {

				_ctr.add( vertices[ loop[ i ] ] );

			}

			_ctr.multiplyScalar( 1.0 / l );

			var loopNormal = new Vector3( 0.0, 0.0, 0.0 );

			// compute loop normal using Newell's Method
			for ( var i = 0, len = loop.length; i < len; i ++ ) {

				var currentVertex = vertices[ loop[ i ] ];
				var nextVertex = vertices[ loop[ ( i + 1 ) % len ] ];

				loopNormal.x += ( currentVertex.y - nextVertex.y ) * ( currentVertex.z + nextVertex.z );
				loopNormal.y += ( currentVertex.z - nextVertex.z ) * ( currentVertex.x + nextVertex.x );
				loopNormal.z += ( currentVertex.x - nextVertex.x ) * ( currentVertex.y + nextVertex.y );

			}

			loopNormal.normalize();

			_plane.setFromNormalAndCoplanarPoint( loopNormal, vertices[ loop[ 0 ] ] );
			var _z = _plane.normal;

			// compute basis
			_q.setFromUnitVectors( Z, _z );
			_x.copy( X ).applyQuaternion( _q );
			_y.crossVectors( _x, _z );
			_y.normalize();
			_basis.makeBasis( _x, _y, _z );
			_basis.setPosition( _ctr );

			// project the 3D vertices on the 2D plane
			var projVertices = [];
			for ( var i = 0; i < l; i ++ ) {

				_tmp.subVectors( vertices[ loop[ i ] ], _ctr );
				projVertices.push( new Vector2( _tmp.dot( _x ), _tmp.dot( _y ) ) );
				newUvs.push( uvs[ loop[ i ] ] );

			}

			// create the geometry (Three.js triangulation with ShapeBufferGeometry)
			var shape = new Shape( projVertices );
			var geometry = new ShapeGeometry( shape );

			// transform geometry back to the initial coordinate system
			geometry.applyMatrix4( _basis );

			for ( var i = 0, lVertices = geometry.vertices.length; i < lVertices; i ++ ) {

				newVertices.push( geometry.vertices[ i ] );

			}

			for ( var i = 0, lFaces = geometry.faces.length; i < lFaces; i ++ ) {

				var face = new Face3(
					geometry.faces[ i ].a + offset,
					geometry.faces[ i ].b + offset,
					geometry.faces[ i ].c + offset
				);

				face.materialIndex = materialID;
				faces.push( face );

			}

			return [ newVertices, newUvs, faces ];

		};

	} )();

	var makeThreeMaterial = function ( rwxMaterial, folder, texExtension = "jpg", maskExtension =
	"zip", jsZip = null, jsZipUtils = null ) {

		var materialDict = {};

		if ( rwxMaterial.materialmode == MaterialMode.DOUBLE ) {

			materialDict[ 'side' ] = DoubleSide;

		} else if ( rwxMaterial.materialmode == MaterialMode.NONE ) {

			materialDict[ 'visible' ] = false;

		}

		if ( rwxMaterial.opacity < 1.0 ) {

			materialDict[ 'transparent' ] = true;

		}

		materialDict[ 'specular' ] = 0xffffff;
		materialDict[ 'emissiveIntensity' ] = rwxMaterial.surface[ 1 ];
		materialDict[ 'shininess' ] = rwxMaterial.surface[ 2 ] *
		30; // '30' is the default Phong material shininess value
		materialDict[ 'opacity' ] = rwxMaterial.opacity;

		var phongMat = new MeshPhongMaterial( materialDict );

		phongMat.userData[ 'collision' ] = rwxMaterial.collision;

		if ( rwxMaterial.texture == null ) {

			phongMat.color.set( ( Math.trunc( rwxMaterial.color[ 0 ] * 255 ) << 16 ) + ( Math.trunc( rwxMaterial
				.color[ 1 ] * 255 ) << 8 ) + Math.trunc( rwxMaterial.color[ 2 ] * 255 ) );

		} else {

			// TODO: try to instanciate once
			var loader = new TextureLoader();
			var texturePath = folder + '/' + rwxMaterial.texture + '.' + texExtension;
			var texture = loader.load( texturePath );
			texture.wrapS = RepeatWrapping;
			texture.wrapT = RepeatWrapping;
			phongMat.map = texture;

			if ( rwxMaterial.mask != null ) {

				phongMat.alphaTest = 0.2;
				phongMat.transparent = true;

				if ( maskExtension == "zip" && jsZip != null && jsZipUtils != null ) {

					// We try to extract the bmp mask from the archive
					const zipPath = folder + '/' + rwxMaterial.mask + '.' + maskExtension;

					// We load the mask asynchronously using JSZip and JSZipUtils (if available)
					new jsZip.external.Promise( function ( resolve, reject ) {

						jsZipUtils.getBinaryContent( zipPath, function ( err, data ) {

							if ( err ) {

								reject( err );

							} else {

								resolve( data );

							}

						} );

					} ).then( jsZip.loadAsync ).then( function ( zip ) {

						// Chain with the bmp content promise
						return zip.file( rwxMaterial.mask + '.bmp' ).async( "uint8array" );

					} ).then( function success( buffer ) {

						// Load the bmp image into a data uri string
						const bmpURI = "data:image/bmp;base64," +
						btoa( String.fromCharCode.apply( null, new Uint16Array( buffer ) ) );

						// Make a texture out of the bmp mask, apply it to the material
						var maskTexture = loader.load( bmpURI );
						maskTexture.wrapS = RepeatWrapping;
						maskTexture.wrapT = RepeatWrapping;
						phongMat.alphaMap = maskTexture;

						// Notify three.js that this material has been updated (to re-render it).
						phongMat.needsUpdate = true;

					}, function error( e ) {

						throw e;

					} );

				} else if ( maskExtension != 'zip' ) {

					var bmpPath = folder + '/' + rwxMaterial.mask + '.' + maskExtension;
					var maskTexture = loader.load( bmpPath );
					maskTexture.wrapS = RepeatWrapping;
					maskTexture.wrapT = RepeatWrapping;
					phongMat.alphaMap = maskTexture;

				}

		  }

		}

		return phongMat;

	};

	var resetGeometry = function ( ctx ) {

		ctx.currentGeometry = new Geometry();
		ctx.currentGeometry.faceVertexUvs[ 0 ] = [];
		ctx.currentUVs = [];

	};

	var makeMeshToCurrentGroup = function ( ctx ) {

		ctx.currentGeometry.uvsNeedUpdate = true;
		ctx.currentGeometry.computeVertexNormals();

		if ( ctx.currentGeometry.faces.length > 0 ) {

			var mesh = new Mesh( ctx.currentGeometry, ctx.materialManager.getCurrentMaterialList() );

			ctx.currentGroup.add( mesh );

		}

	};

	var RWXMaterial = ( function () {

		function RWXMaterial() {

			// Material related properties start here
			this.color = [ 0.0, 0.0, 0.0 ]; // Red, Green, Blue
			this.surface = [ 0.0, 0.0, 0.0 ]; // Ambience, Diffusion, Specularity
			this.opacity = 1.0;
			this.lightsampling = LightSampling.FACET;
			this.geometrysampling = GeometrySampling.SOLID;
			this.texturemodes = [ TextureMode
				.LIT,
			]; // There's possibly more than one mode enabled at a time (hence why we use an array)
			this.materialmode = MaterialMode.NULL; // Neither NONE nor DOUBLE: we only render one side of the polygon
			this.texture = null;
			this.mask = null;
			this.collision = true;
			// End of material related properties

			this.transform = new Matrix4();

		}

		RWXMaterial.prototype = {

			constructor: RWXMaterial,

			getMatSignature: function () {

				var sign = this.color[ 0 ].toFixed( 3 ) + this.color[ 1 ].toFixed( 3 ) + this.color[ 2 ].toFixed( 3 );
				sign += this.surface[ 0 ].toFixed( 3 ) + this.surface[ 1 ].toFixed( 3 ) + this.surface[ 2 ].toFixed( 3 );
				sign += this.opacity.toFixed( 3 );
				sign += this.lightsampling.toString() + this.geometrysampling.toString();
				this.texturemodes.forEach( ( tm ) => {

					sign += tm.toString();

				} );
				sign += this.materialmode.toString();

				if ( this.texture != null ) {

					sign += this.texture;

				}

				sign += this.collision.toString();

				return sign;

			}

		};

		return RWXMaterial;

	} )();

	var RWXMaterialManager = ( function () {

		function RWXMaterialManager( folder, texExtension = "jpg", maskExtension =
		"zip", jsZip = null, jsZipUtils = null ) {

			this.folder = folder;
			this.texExtension = texExtension;
			this.maskExtension = maskExtension;
			this.jsZip = jsZip;
			this.jsZipUtils = jsZipUtils;

			this.currentRWXMaterial = new RWXMaterial();
			this.threeMaterialMap = {};
			this.currentMaterialID = null;
			this.currentMaterialList = [];
			this.currentMaterialSignature = "";

		}

		RWXMaterialManager.prototype = {

			constructor: RWXMaterialManager,

			getCurrentMaterialID: function () {

				const materialSignature = this.currentRWXMaterial.getMatSignature();

				// This gets called when the material is actually required by (at least) one face,
				// meaning we need to save the material in the map if it's not already done
				if ( this.threeMaterialMap[ materialSignature ] === undefined ) {

					this.threeMaterialMap[ materialSignature ] = makeThreeMaterial( Object.assign( new RWXMaterial(), this.currentRWXMaterial ),
						this.folder, this.texExtension, this.maskExtension, this.jsZip, this.jsZipUtils );
					this.threeMaterialMap[ materialSignature ].needsUpdate = true;

				}

				if ( this.currentMaterialSignature != materialSignature ) {

					this.currentMaterialSignature = materialSignature;

					// We're onto a new material given the current list, we need to add it to the list and increment the ID
					if ( this.currentMaterialID === null ) {

						this.currentMaterialID = 0;

					} else {

						this.currentMaterialID ++;

					}

					this.currentMaterialList.push( this.threeMaterialMap[ materialSignature ] );

				}

				return this.currentMaterialID;

			},

			getCurrentMaterialList: function () {

				return this.currentMaterialList;

			},

			resetCurrentMaterialList: function () {

				this.currentMaterialID = null;
				this.currentMaterialList = [];
				this.currentMaterialSignature = "";

			}

		};

		return RWXMaterialManager;

	} )();

	function RWXLoader( manager ) {

		Loader.call( this, manager );

		this.integerRegex = new RegExp( "([-+]?[0-9]+)", 'g' );
		this.floatRegex = new RegExp( "([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+))", 'g' );
		this.nonCommentRegex = new RegExp( "^(.*)#", 'g' );
		this.modelbeginRegex = new RegExp( "^ *(modelbegin).*$", 'i' );
		this.modelendRegex = new RegExp( "^ *(modelend).*$", 'i' );
		this.clumpbeginRegex = new RegExp( "^ *(clumpbegin).*$", 'i' );
		this.clumpendRegex = new RegExp( "^ *(clumpend).*$", 'i' );
		this.transformbeginRegex = new RegExp( "^ *(transformbegin).*$", 'i' );
		this.transformendRegex = new RegExp( "^ *(transformend).*$", 'i' );
		this.protobeginRegex = new RegExp( "^ *(protobegin) +([A-Za-z0-9_\\-]+).*$", 'i' );
		this.protoinstanceRegex = new RegExp( "^ *(protoinstance) +([A-Za-z0-9_\\-]+).*$", 'i' );
		this.protoendRegex = new RegExp( "^ *(protoend).*$", 'i' );
		this.vertexRegex = new RegExp(
			"^ *(vertex|vertexext)(( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)){3}) *(uv(( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)){2}))?.*$",
			'i' );
		this.polygonRegex = new RegExp( "^ *(polygon|polygonext)( +[0-9]+)(( +[0-9]+)+) ?.*$", 'i' );
		this.quadRegex = new RegExp( "^ *(quad|quadext)(( +([0-9]+)){4}).*$", 'i' );
		this.triangleRegex = new RegExp( "^ *(triangle|triangleext)(( +([0-9]+)){3}).*$", 'i' );
		this.textureRegex = new RegExp( "^ *(texture) +([A-Za-z0-9_\\-]+) *(mask *([A-Za-z0-9_\\-]+))?.*$", 'i' );
		this.colorRegex = new RegExp( "^ *(color)(( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)){3}).*$", 'i' );
		this.opacityRegex = new RegExp( "^ *(opacity)( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)).*$", 'i' );
		this.transformRegex = new RegExp( "^ *(transform)(( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)){16}).*$", 'i' );
		this.scaleRegex = new RegExp( "^ *(scale)(( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)){3}).*$", 'i' );
		this.rotateRegex = new RegExp( "^ *(rotate)(( +[-+]?[0-9]*){4})$", 'i' );
		this.surfaceRegex = new RegExp( "^ *(surface)(( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)){3}).*$", 'i' );
		this.ambientRegex = new RegExp( "^ *(ambient)( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)).*$", 'i' );
		this.diffuseRegex = new RegExp( "^ *(diffuse)( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)).*$", 'i' );
		this.specularRegex = new RegExp( "^ *(specular)( +[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)).*$", 'i' );
		this.materialModeRegex = new RegExp( "^ *((add)?materialmode(s)?) +([A-Za-z0-9_\\-]+).*$", 'i' );
		this.collisionRegex = new RegExp( "^ *(collision) +(on|off).*$", 'i' );

	}

	RWXLoader.prototype = Object.assign( Object.create( Loader.prototype ), {

		constructor: RWXLoader,

		jsZip: null,

		jsZipUtils: null,

		texExtension: 'jpg',

		maskExtension: 'zip',

		setJSZip: function ( jsZip, jsZipUtils ) {

			this.jsZip = jsZip;
			this.jsZipUtils = jsZipUtils;

			return this;

		},

		setTexExtension: function ( texExtension ) {

			this.texExtension = texExtension;

			return this;

		},

		setMaskExtension: function ( maskExtension ) {

			this.maskExtension = maskExtension;

			return this;

		},

		load: function ( rwxFile, onLoad, onProgress, onError ) {

			var scope = this;
			var path = this.path;
			var resourcePath = this.resourcePath;

			var loader = new FileLoader( this.manager );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( path + "/" + rwxFile, function ( text ) {

				try {

					onLoad( scope.parse( text, resourcePath ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( rwxFile );

				}

			}, onProgress, onError );

		},

		parse: function ( str, textureFolderPath ) {

			// Parsing RWX file content

			const defaultSurface = [ 0.0, 0.0, 0.0 ];

			var ctx = {
				groupStack: [],
				currentGroup: null,

				transformStack: [],

				currentTransform: new Matrix4(),
				currentGeometry: null,
				currentUVs: [],

				rwxClumpStack: [],
				rwxProtoDict: {},

				materialManager: new RWXMaterialManager( textureFolderPath, this.texExtension, this.maskExtension, this.jsZip, this.jsZipUtils )
			};

			var transformBeforeProto = null;
			var groupBeforeProto = null;

			const lines = str.split( /[\n\r]+/g );

			for ( var i = 0, l = lines.length; i < l; i ++ ) {

				var line = lines[ i ];

				// strip comment away (if any)
				var res = this.nonCommentRegex.exec( line );
				if ( res != null ) {

					line = res[ 1 ];

				}

				// replace tabs with spaces
				line = line.trim().replace( /\t/g, ' ' );

				res = this.modelbeginRegex.exec( line );
				if ( res != null ) {

					ctx.groupStack.push( new Group() );
					ctx.currentGroup = ctx.groupStack.slice( - 1 )[ 0 ];

					ctx.transformStack.push( ctx.currentTransform );

					continue;

				}

				res = this.clumpbeginRegex.exec( line );
				if ( res != null ) {

					var group = new Group();
					ctx.currentGroup.add( group );
					ctx.groupStack.push( group );
					ctx.currentGroup = group;

					resetGeometry( ctx );

					ctx.transformStack.push( ctx.currentTransform );
					ctx.currentTransform = new Matrix4();

					continue;

				}

				res = this.clumpendRegex.exec( line );
				if ( res != null ) {

					makeMeshToCurrentGroup( ctx );

					ctx.currentGroup = ctx.groupStack.pop();
					ctx.currentTransform = ctx.transformStack.pop();

					resetGeometry( ctx );

					ctx.materialManager.resetCurrentMaterialList();

					continue;

				}

				res = this.transformbeginRegex.exec( line );
				if ( res != null ) {

					var group = new Group();
					ctx.currentGroup.add( group );
					ctx.groupStack.push( group );
					ctx.currentGroup = group;

					ctx.transformStack.push( ctx.currentTransform );
					ctx.currentTransform = new Matrix4();

					continue;

				}

				res = this.transformendRegex.exec( line );
				if ( res != null ) {

					ctx.currentGroup = ctx.groupStack.pop();
					ctx.currentTransform = ctx.transformStack.pop();

					continue;

				}

				res = this.protobeginRegex.exec( line );
				if ( res != null ) {

					var name = res[ 2 ];

					transformBeforeProto = ctx.currentGroup;
					groupBeforeProto = ctx.currentTransform;

					ctx.rwxProtoDict[ name ] = new Group();
					ctx.currentTransform = new Matrix4();
					ctx.currentGeometry = new Geometry();
					ctx.currentGeometry.faceVertexUvs[ 0 ] = [];
					ctx.currentUVs = [];

					ctx.materialManager.currentRWXMaterial = new RWXMaterial();
					ctx.currentGroup = ctx.rwxProtoDict[ name ];

					continue;

				}

				res = this.protoendRegex.exec( line );
				if ( res != null ) {

					makeMeshToCurrentGroup( ctx );

					ctx.currentGroup = transformBeforeProto;
					ctx.currentTransform = groupBeforeProto;

					ctx.currentGeometry = new Geometry();
					ctx.currentGeometry.faceVertexUvs[ 0 ] = [];
					ctx.currentUVs = [];

					ctx.materialManager.resetCurrentMaterialList();

					continue;

				}

				res = this.protoinstanceRegex.exec( line );
				if ( res != null ) {

					name = res[ 2 ];
					var protoMesh = ctx.rwxProtoDict[ name ].clone();
					var tmpTransform = getFinalTransform( ctx );
					protoMesh.applyMatrix4( tmpTransform );
					ctx.currentGroup.add( protoMesh );

					continue;

				}

				res = this.textureRegex.exec( line );
				if ( res != null ) {

					if ( res[ 2 ].toLowerCase() == "null" ) {

						ctx.materialManager.currentRWXMaterial.texture = null;

					} else {

						ctx.materialManager.currentRWXMaterial.texture = res[ 2 ];

					}

					if ( res[ 4 ] !== undefined ) {

						ctx.materialManager.currentRWXMaterial.mask = res[ 4 ];

					} else {

						ctx.materialManager.currentRWXMaterial.mask = null;

					}

					continue;

				}

				res = this.triangleRegex.exec( line );
				if ( res != null ) {

					var vId = [];
					res[ 2 ].match( this.integerRegex ).forEach( ( entry ) => {

						vId.push( parseInt( entry ) - 1 );

					} );

					var face = new Face3( vId[ 0 ], vId[ 1 ], vId[ 2 ] );
					face.materialIndex = ctx.materialManager.getCurrentMaterialID();
					ctx.currentGeometry.faces.push( face );
					ctx.currentGeometry.faceVertexUvs[ 0 ].push( [
						ctx.currentUVs[ vId[ 0 ] ], ctx.currentUVs[ vId[ 1 ] ], ctx.currentUVs[ vId[ 2 ] ]
					] );

					continue;

				}

				res = this.quadRegex.exec( line );
				if ( res != null ) {

					var vId = [];
					res[ 2 ].match( this.integerRegex ).forEach( ( entry ) => {

						vId.push( parseInt( entry ) - 1 );

					} );

					var face = new Face3( vId[ 0 ], vId[ 1 ], vId[ 2 ] );
					face.materialIndex = ctx.materialManager.getCurrentMaterialID();
					ctx.currentGeometry.faces.push( face );
					face = new Face3( vId[ 0 ], vId[ 2 ], vId[ 3 ] );
					face.materialIndex = ctx.materialManager.getCurrentMaterialID();
					ctx.currentGeometry.faces.push( face );

 					ctx.currentGeometry.faceVertexUvs[ 0 ].push( [
						ctx.currentUVs[ vId[ 0 ] ], ctx.currentUVs[ vId[ 1 ] ], ctx.currentUVs[ vId[ 2 ] ]
					] );
					ctx.currentGeometry.faceVertexUvs[ 0 ].push( [
						ctx.currentUVs[ vId[ 0 ] ], ctx.currentUVs[ vId[ 2 ] ], ctx.currentUVs[ vId[ 3 ] ]
					] );

					continue;

				}

				res = this.polygonRegex.exec( line );
				if ( res != null ) {

					var vLen = parseInt( res[ 2 ].match( this.integerRegex )[ 0 ] );
					var vId = [];
					res[ 3 ].match( this.integerRegex ).forEach( ( id ) => {

						vId.unshift( parseInt( id ) - 1 );

					} );

					const [ newVertices, newUVs, newFaces ] =
					triangulateFacesWithShapes( ctx.currentGeometry.vertices, ctx.currentUVs, vId, ctx.materialManager.getCurrentMaterialID() );

					const preInsertionLength = ctx.currentGeometry.vertices.length;
					ctx.currentGeometry.vertices.push( ...newVertices );
					ctx.currentGeometry.faces.push( ...newFaces );

					for ( var lf = 0; lf < newFaces.length; lf ++ ) {

						const vid1 = newFaces[ lf ].a;
						const vid2 = newFaces[ lf ].b;
						const vid3 = newFaces[ lf ].c;

						ctx.currentGeometry.faceVertexUvs[ 0 ].push( [
							newUVs[ vid1 - preInsertionLength ],
							newUVs[ vid2 - preInsertionLength ],
							newUVs[ vid3 - preInsertionLength ]
						] );

					}

					continue;

				}

				res = this.vertexRegex.exec( line );
				if ( res != null ) {

					var vprops = [];
					res[ 2 ].match( this.floatRegex ).forEach( ( x ) => {

						vprops.push( parseFloat( x ) );

					} );

					var tmpVertex = new Vector4( vprops[ 0 ], vprops[ 1 ], vprops[ 2 ] );
					tmpVertex.applyMatrix4( getFinalTransform( ctx ) );
					ctx.currentGeometry.vertices.push( new Vector3( tmpVertex.x, tmpVertex.y, tmpVertex.z ) );

					if ( typeof ( res[ 7 ] ) != "undefined" ) {

						var moreVprops = [];
						res[ 7 ].match( this.floatRegex ).forEach( ( x ) => {

							moreVprops.push( parseFloat( x ) );

						} );

						ctx.currentUVs.push( new Vector2( moreVprops[ 0 ], 1 - moreVprops[ 1 ] ) );

					} else {

						ctx.currentUVs.push( new Vector2( 0.0, 0.0 ) );

					}

					continue;

				}

				res = this.colorRegex.exec( line );
				if ( res != null ) {

					var cprops = [];
					res[ 2 ].match( this.floatRegex ).forEach( ( x ) => {

						cprops.push( parseFloat( x ) );

					} );

					if ( cprops.length == 3 ) {

						ctx.materialManager.currentRWXMaterial.color = cprops;

					}

					continue;

				}

				res = this.opacityRegex.exec( line );
				if ( res != null ) {

					ctx.materialManager.currentRWXMaterial.opacity = parseFloat( res[ 2 ] );
					continue;

				}

				res = this.transformRegex.exec( line );
				if ( res != null ) {

					var tprops = [];
					res[ 2 ].match( this.floatRegex ).forEach( ( x ) => {

						tprops.push( parseFloat( x ) );

					} );

					if ( tprops.length == 16 ) {

						ctx.currentTransform.fromArray( tprops );

					}

					continue;

				}

				res = this.rotateRegex.exec( line );
				if ( res != null ) {

					var rprops = [];
					res[ 2 ].match( this.integerRegex ).forEach( ( x ) => {

						rprops.push( parseInt( x ) );

					} );

					if ( rprops.length == 4 ) {

						var rotateM = new Matrix4();

						if ( rprops[ 0 ] ) {

							rotateM.makeRotationX( MathUtils.degToRad( - rprops[ 3 ] ) );
							ctx.currentTransform.premultiply( rotateM );

						}

						if ( rprops[ 1 ] ) {

							rotateM.makeRotationY( MathUtils.degToRad( - rprops[ 3 ] ) );
							ctx.currentTransform.premultiply( rotateM );

						}

						if ( rprops[ 2 ] ) {

							rotateM.makeRotationZ( MathUtils.degToRad( - rprops[ 3 ] ) );
							ctx.currentTransform.premultiply( rotateM );

						}

					}

					continue;

				}

				res = this.scaleRegex.exec( line );
				if ( res != null ) {

					var sprops = [];
					res[ 2 ].match( this.floatRegex ).forEach( ( x ) => {

						sprops.push( parseFloat( x ) );

					} );

					var scaleM = new Matrix4();

					if ( sprops.length == 3 ) {

						scaleM.makeScale( sprops[ 0 ], sprops[ 1 ], sprops[ 2 ] );
						ctx.currentTransform.premultiply( scaleM );

					}

					continue;

				}

				res = this.surfaceRegex.exec( line );
				if ( res != null ) {

					var sprops = [];
					res[ 2 ].match( this.floatRegex ).forEach( ( x ) => {

						sprops.push( parseFloat( x ) );

					} );

					ctx.materialManager.currentRWXMaterial.surface = sprops;
					continue;

				}

				res = this.ambientRegex.exec( line );
				if ( res != null ) {

					ctx.materialManager.currentRWXMaterial.surface[ 0 ] = parseFloat( res[ 2 ] );
					continue;

				}

				res = this.diffuseRegex.exec( line );
				if ( res != null ) {

					ctx.materialManager.currentRWXMaterial.surface[ 1 ] = parseFloat( res[ 2 ] );
					continue;

				}

				res = this.specularRegex.exec( line );
				if ( res != null ) {

					ctx.materialManager.currentRWXMaterial.surface[ 2 ] = parseFloat( res[ 2 ] );
					continue;

				}

				res = this.materialModeRegex.exec( line );
				if ( res != null ) {

					const matMode = res[ 4 ].toLowerCase();

					if ( matMode == "none" ) {

						ctx.materialManager.currentRWXMaterial.materialmode = MaterialMode.NONE;

					} else if ( matMode == "null" ) {

						ctx.materialManager.currentRWXMaterial.materialmode = MaterialMode.NULL;

					} else if ( matMode == "double" ) {

						ctx.materialManager.currentRWXMaterial.materialmode = MaterialMode.DOUBLE;

					}

					continue;

				}

				res = this.collisionRegex.exec( line );
				if ( res != null ) {

					const collision = res[ 2 ].toLowerCase();

					if ( collision == "on" ) {

						ctx.materialManager.currentRWXMaterial.collision = true;

					} else if ( collision == "off" ) {

						ctx.materialManager.currentRWXMaterial.collision = false;

					}

					continue;

				}

			}

			// We're done, return the root group to get the whole object, we take the decadecimal unit into account
			var scale_ten = new Matrix4();
			scale_ten.makeScale( 10.0, 10.0, 10.0 );

			ctx.groupStack[ 0 ].applyMatrix4( scale_ten );

			return ctx.groupStack[ 0 ];

		}

	} );

	return RWXLoader;

} )();

export {
	RWXLoader
};