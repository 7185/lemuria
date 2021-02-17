/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {
	BufferGeometry,
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
	Texture
} from 'three';

var RWXLoader = ( function () {

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

		return function ( vertices, uvs, loops, loopMatIds = [] ) {

			var newVertices = [];
			var newUvs = [];
			var faces = [];

			var offset = vertices.length;

			for ( var lid = 0, llen = loops.length; lid < llen; lid ++ ) {

				var loop = loops[ lid ];

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
					newUvs.push( [ uvs[ loop[ i ] ][ 0 ], uvs[ loop[ i ] ][ 1 ] ] );

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

					var face = new Face3( geometry.faces[ i ].a + offset,
						geometry.faces[ i ].b + offset,
						geometry.faces[ i ].c + offset );
					face.materialIndex = loopMatIds[ lid ];
					faces.push( face );

				}

				offset += geometry.vertices.length;

			}

			return [ newVertices, newUvs, faces ];

		};

	} )();

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

	var RWXState = ( function () {

		function RWXState() {

			// Material related properties start here
			this.color = [ 0.0, 0.0, 0.0 ]; // Red, Green, Blue
			this.surface = [ 0.0, 0.0, 0.0 ]; // Ambience, Diffusion, Specularity
			this.opacity = 1.0;
			this.lightsampling = LightSampling.FACET;
			this.geometrysampling = GeometrySampling.SOLID;
			this.texturemodes = [ TextureMode
				.LIT,
			]; // There's possibly more than one mode enabled at a time (hence why we use an array)
			this.materialmode = MaterialMode.NONE; // Neither NULL nor DOUBLE: we only render one side of the polygon
			this.texture = null;
			this.mask = null;
			this.collision = true;
			// End of material related properties

			this.transform = new Matrix4();

		}

		RWXState.prototype = {

			constructor: RWXState,

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

		return RWXState;

	} )();

	var RWXVertex = ( function () {

		function RWXVertex( x, y, z, u = null, v = null ) {

			this.x = x;
			this.y = y;
			this.z = z;
			this.u = u;
			this.v = v;

		}

		RWXVertex.prototype = {

			constructor: RWXVertex

		};

		return RWXVertex;

	} )();

	var RWXShape = ( function () {

		function RWXShape( state = null ) {

			this.state = new RWXState();
			if ( state != null ) {

				Object.assign( this.state, state );

			}

			this.verticesId = [];

		}

		RWXShape.prototype = {

			constructor: RWXShape,

		};

		return RWXShape;

	} )();

	var RWXTriangle = ( function () {

		function RWXTriangle( v1, v2, v3, state = new RWXState() ) {

			RWXShape.call( this, state );
			this.verticesId = [ v1, v2, v3 ];

		}

		RWXTriangle.prototype = Object.assign( Object.create( RWXShape.prototype ), {

			constructor: RWXTriangle,

			asTriangles: function ( offset = 0 ) {

				if ( offset ) {

					return [ new RWXTriangle( this.verticesId[ 0 ] + offset,
						this.verticesId[ 1 ] + offset,
						this.verticesId[ 2 ] + offset,
						this.state ) ];

				} else {

					return [ this ];

				}

			},

			asFace3: function ( offset = 0 ) {

				return new Face3( this.verticesId[ 0 ] + offset,
					this.verticesId[ 1 ] + offset,
					this.verticesId[ 2 ] + offset );

			}

		} );

		return RWXTriangle;

	} )();

	var RWXQuad = ( function () {

		function RWXQuad( v1, v2, v3, v4, state = new RWXState() ) {

			RWXShape.call( this, state );
			this.verticesId = [ v1, v2, v3, v4 ];

		}

		RWXQuad.prototype = Object.assign( Object.create( RWXShape.prototype ), {

			constructor: RWXQuad,

			asTriangles: function ( offset = 0 ) {

				return [ new RWXTriangle( this.verticesId[ 0 ] + offset,
					this.verticesId[ 1 ] + offset,
					this.verticesId[ 2 ] + offset,
					this.state ),
				new RWXTriangle( this.verticesId[ 0 ] + offset,
					this.verticesId[ 2 ] + offset,
					this.verticesId[ 3 ] + offset,
					this.state )
				];

			}

		} );

		return RWXQuad;

	} )();

	var RWXPolygon = ( function () {

		function RWXPolygon( verticesId, state = new RWXState() ) {

			RWXShape.call( this, state );
			this.verticesId = verticesId;

			if ( this.verticesId[ 0 ] == this.verticesId.slice( - 1 )[ 0 ] )
				this.verticesId.splice( - 1, 1 );

		}

		RWXPolygon.prototype = Object.assign( Object.create( RWXShape.prototype ), {

			constructor: RWXPolygon,

			asLoop: function ( offset = 0 ) {

				if ( offset ) {

					var loop = [];
					this.verticeId.forEach( ( id ) => {

						loop.push( id + offset );

					} );
					return loop;

				} else {

					return this.verticesId;

				}

			}

		} );

		return RWXPolygon;

	} )();

	var RWXScope = ( function () {

		function RWXScope( state = null ) {

			this.state = new RWXState();
			if ( state != null ) {

				Object.assign( this.state, state );

			}

			this.vertices = [];
			this.shapes = [];

		}

		RWXScope.prototype = {

			constructor: RWXScope,

			getTriangles: function ( offset = 0 ) {

				var faces = [];
				this.shapes.forEach( ( shape ) => {

					if ( typeof shape.asTriangles === 'function' ) {

						faces.push( ...shape.asTriangles( offset ) );

					}

				} );

				return faces;

			},

			getPolys: function () {

				var polys = [];
				this.shapes.forEach( ( shape ) => {

					if ( typeof shape.asLoop === 'function' ) {

						polys.push( shape );

					}

				} );

				return polys;

			},

		};

		return RWXScope;

	} )();

	var RWXClump = ( function () {

		function RWXClump( state = new RWXState() ) {

			RWXScope.call( this, state );
			this.clumps = [];

		}

		RWXClump.prototype = Object.assign( Object.create( RWXScope.prototype ), {

			constructor: RWXClump,

			applyProto: function ( proto ) {

				var offset = this.vertices.length;

				var shapes = [];
				if ( proto.shapes != null ) {

					Object.assign( shapes, proto.shapes );

				}

				shapes.forEach( ( shape ) => {
					// Collision status of the clump takes precedence over the one from the proto
					shape.state.collision = this.state.collision;
					for ( var i = 0; i < shape.verticesId.length; i ++ ) {

						shape.verticesId[ i ] += offset;

					}

				} );

				this.shapes.push( ...shapes );

				proto.vertices.forEach( ( vert ) => {

					var mat = proto.state.transform.clone();
					var vec4 = new Vector4( vert.x, vert.y, vert.z, 1 );
					vec4.applyMatrix4( mat );
					this.vertices.push( new RWXVertex( vec4.x, vec4.y, vec4.z, vert.u, vert.v ) );

				} );

			}

		} );

		return RWXClump;

	} )();

	var RWXObject = ( function () {

		function RWXObject() {

			this.protos = [];
			this.clumps = [];
			this.state = new RWXState();

		}

		RWXObject.prototype = {

			constructor: RWXObject

		};

		return RWXObject;

	} )();

	var gatherVerticesRecursive = function ( clump ) {

		var vertices = [];
		var uvs = [];
		var transform = clump.state.transform;

		clump.vertices.forEach( ( v ) => {

			var vert = ( new Vector4( v.x, v.y, v.z, 1 ) ).applyMatrix4( transform );
			vertices.push( new Vector3( vert.x, vert.y, vert.z ) );
			uvs.push( [ v.u, v.v ] );

		} );

		clump.clumps.forEach( ( c ) => {

			var [ tmpVertices, tmpUvs ] = gatherVerticesRecursive( c );
			vertices.push( ...tmpVertices );
			uvs.push( ...tmpUvs );

		} );

		return [ vertices, uvs ];

	};

	var gatherFacesRecursive = function ( clump, materialsMap = {}, offset = 0 ): [any[], any[], any[], number] {

		var faces: any[] = [];
		var tmpFaces: any[] = [];
		var loops: any[] = [];
		var loopSignatures: any[] = [];
		var tmpLoops: any[] = [];
		var tmpLoopsignatures: any[] = [];
		var tmpTriangles = clump.getTriangles( offset );
		var tmpPolys = clump.getPolys();

		tmpTriangles.forEach( ( tmpTriangle ) => {

			var face = tmpTriangle.asFace3();
			face.materialIndex = materialsMap[ tmpTriangle.state.getMatSignature() ];
			faces.push( face );

		} );

		tmpPolys.forEach( ( tmpPoly ) => {

			var loop = [];
			tmpPoly.asLoop().forEach( ( verticeId ) => {

				loop.push( verticeId + offset );

			} );
			loops.push( loop );
			loopSignatures.push( materialsMap[ tmpPoly.state.getMatSignature() ] );

		} );

		offset += clump.vertices.length;

		clump.clumps.forEach( ( c ) => {

			[ tmpFaces, tmpLoops, tmpLoopsignatures, offset ] = gatherFacesRecursive( c, materialsMap, offset );
			faces.push( ...tmpFaces );
			loops.push( ...tmpLoops );
			loopSignatures.push( ...tmpLoopsignatures );

		} );

		return [ faces, loops, loopSignatures, offset ];

	};

	var makeMaterialsRecursive = function ( clump, folder, materialMap = {}, texExtension = "jpg", maskExtension =
	"zip", jsZip = null, jsZipUtils = null ) {

		clump.shapes.forEach( ( shape ) => {

			var matSign = shape.state.getMatSignature();

			if ( materialMap[ matSign ] === undefined ) {

				var materialDict = {};

				if ( shape.state.materialmode == MaterialMode.DOUBLE ) {

					materialDict[ 'side' ] = DoubleSide;

				} else if ( shape.state.materialmode == MaterialMode.NULL ) {

					materialDict[ 'visible' ] = false;

				}

				if ( shape.state.opacity < 1.0 ) {

					materialDict[ 'transparent' ] = true;

				}

				materialDict[ 'specular' ] = 0xffffff;
				materialDict[ 'emissiveIntensity' ] = shape.state.surface[ 1 ];
				materialDict[ 'shininess' ] = shape.state.surface[ 2 ] *
				30; // '30' is the default Phong material shininess value
				materialDict[ 'opacity' ] = shape.state.opacity;

				var phongMat = new MeshPhongMaterial( materialDict );

				phongMat.userData[ 'collision' ] = shape.state.collision;

				if ( shape.state.texture == null ) {

					phongMat.color.set( ( Math.trunc( shape.state.color[ 0 ] * 255 ) << 16 ) + ( Math.trunc( shape.state
						.color[ 1 ] * 255 ) << 8 ) + Math.trunc( shape.state.color[ 2 ] * 255 ) );

				} else {

					// TODO: try to instanciate once
					var loader = new TextureLoader();
					var texturePath = folder + '/' + shape.state.texture + '.' + texExtension;
					var texture = loader.load( texturePath );
					texture.wrapS = RepeatWrapping;
					texture.wrapT = RepeatWrapping;
					phongMat.map = texture;

					if ( shape.state.mask != null ) {

						phongMat.alphaTest = 0.2;
						phongMat.transparent = true;

						if ( maskExtension == "zip" && jsZip != null && jsZipUtils != null ) {

							// We try to extract the bmp mask from the archive
							const zipPath = folder + '/' + shape.state.mask + '.' + maskExtension;

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
								return zip.file( shape.state.mask + '.bmp' ).async( "uint8array" );

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

							var bmpPath = folder + '/' + shape.state.mask + '.' + maskExtension;
							var maskTexture = loader.load( bmpPath );
							maskTexture.wrapS = RepeatWrapping;
							maskTexture.wrapT = RepeatWrapping;
							phongMat.alphaMap = maskTexture;

						}

					}

				}

				materialMap[ matSign ] = phongMat;

			}

		} );

		clump.clumps.forEach( ( subClump ) => {

			materialMap = Object.assign( {}, materialMap,
				makeMaterialsRecursive( subClump, folder, materialMap, texExtension, maskExtension, jsZip, jsZipUtils ) );

		} );

		return materialMap;

	};

	function RWXLoader( manager ) {

		Loader.call( this, manager );

		this.integerRegex = new RegExp( "([-+]?[0-9]+)", 'g' );
		this.floatRegex = new RegExp( "([+-]?([0-9]+([.][0-9]*)?|[.][0-9]+))", 'g' );
		this.nonCommentRegex = new RegExp( "^(.*)#", 'g' );
		this.modelbeginRegex = new RegExp( "^ *(modelbegin).*$", 'i' );
		this.modelendRegex = new RegExp( "^ *(modelend).*$", 'i' );
		this.clumpbeginRegex = new RegExp( "^ *(clumpbegin).*$", 'i' );
		this.clumpendRegex = new RegExp( "^ *(clumpend).*$", 'i' );
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

			var rwxClumpStack = [];
			var rwxProtoDict = {};
			var currentScope = null;

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

					rwxClumpStack.push( new RWXObject() );
					currentScope = rwxClumpStack.slice( - 1 )[ 0 ];
					currentScope.state.surface = defaultSurface;
					continue;

				}

				res = this.clumpbeginRegex.exec( line );
				if ( res != null ) {

					var rwxClump = new RWXClump( currentScope.state );
					rwxClumpStack.slice( - 1 )[ 0 ].clumps.push( rwxClump );
					rwxClumpStack.push( rwxClump );
					currentScope = rwxClump;
					continue;

				}

				res = this.clumpendRegex.exec( line );
				if ( res != null ) {

					rwxClumpStack.pop();
					currentScope = rwxClumpStack.slice( - 1 )[ 0 ];
					continue;

				}

				res = this.protobeginRegex.exec( line );
				if ( res != null ) {

					var name = res[ 2 ];
					rwxProtoDict[ name ] = new RWXScope( currentScope.state );
					currentScope = rwxProtoDict[ name ];
					continue;

				}

				res = this.protoendRegex.exec( line );
				if ( res != null ) {

					currentScope = rwxClumpStack[ 0 ];
					continue;

				}

				res = this.protoinstanceRegex.exec( line );
				if ( res != null ) {

					name = res[ 2 ];
					currentScope.applyProto( rwxProtoDict[ name ] );
					continue;

				}

				res = this.textureRegex.exec( line );
				if ( res != null ) {

					if ( res[ 2 ].toLowerCase() == "null" ) {

						currentScope.state.texture = null;

					} else {

						currentScope.state.texture = res[ 2 ];

					}

					if ( res[ 4 ] !== undefined ) {

						currentScope.state.mask = res[ 4 ];

					} else {

						currentScope.state.mask = null;

					}

					continue;

				}

				res = this.triangleRegex.exec( line );
				if ( res != null ) {

					var vId = [];
					res[ 2 ].match( this.integerRegex ).forEach( ( entry ) => {

						vId.push( parseInt( entry ) - 1 );

					} );
					currentScope.shapes.push( new RWXTriangle( vId[ 0 ], vId[ 1 ], vId[ 2 ], currentScope.state ) );
					continue;

				}

				res = this.quadRegex.exec( line );
				if ( res != null ) {

					var vId = [];
					res[ 2 ].match( this.integerRegex ).forEach( ( entry ) => {

						vId.push( parseInt( entry ) - 1 );

					} );
					currentScope.shapes.push( new RWXQuad( vId[ 0 ], vId[ 1 ], vId[ 2 ], vId[ 3 ], currentScope.state ) );
					continue;

				}

				res = this.polygonRegex.exec( line );
				if ( res != null ) {

					var vLen = parseInt( res[ 2 ].match( this.integerRegex )[ 0 ] );
					var vId = [];
					res[ 3 ].match( this.integerRegex ).forEach( ( id ) => {

						vId.unshift( parseInt( id ) - 1 );

					} );
					currentScope.shapes.push( new RWXPolygon( vId.slice( 0, vLen ), currentScope.state ) );
					continue;

				}

				res = this.vertexRegex.exec( line );
				if ( res != null ) {

					var vprops = [];
					res[ 2 ].match( this.floatRegex ).forEach( ( x ) => {

						vprops.push( parseFloat( x ) );

					} );

					if ( typeof ( res[ 7 ] ) != "undefined" ) {

						var moreVprops = [];
						res[ 7 ].match( this.floatRegex ).forEach( ( x ) => {

							moreVprops.push( parseFloat( x ) );

						} );

						currentScope.vertices.push( new RWXVertex( vprops[ 0 ], vprops[ 1 ], vprops[ 2 ],
							moreVprops[ 0 ], 1.0 - moreVprops[ 1 ] ) );

					} else {

						currentScope.vertices.push( new RWXVertex( vprops[ 0 ], vprops[ 1 ], vprops[ 2 ] ) );

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

						currentScope.state.color = cprops;

					}

					continue;

				}

				res = this.opacityRegex.exec( line );
				if ( res != null ) {

					currentScope.state.opacity = parseFloat( res[ 2 ] );
					continue;

				}

				res = this.transformRegex.exec( line );
				if ( res != null ) {

					var tprops = [];
					res[ 2 ].match( this.floatRegex ).forEach( ( x ) => {

						tprops.push( parseFloat( x ) );

					} );

					if ( tprops.length == 16 ) {

						currentScope.state.transform = new Matrix4();
						currentScope.state.transform.fromArray( tprops );

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

							currentScope.state.transform =
								rotateM.makeRotationX( MathUtils.degToRad( - rprops[ 3 ] ) ).multiply( currentScope.state
									.transform );

						}

						if ( rprops[ 1 ] ) {

							currentScope.state.transform =
								rotateM.makeRotationY( MathUtils.degToRad( - rprops[ 3 ] ) ).multiply( currentScope.state
									.transform );

						}

						if ( rprops[ 2 ] ) {

							currentScope.state.transform =
								rotateM.makeRotationZ( MathUtils.degToRad( - rprops[ 3 ] ) ).multiply( currentScope.state
									.transform );

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

					if ( sprops.length == 3 ) {

						var scaleM = new Matrix4();

						currentScope.state.transform =
							scaleM.makeScale( sprops[ 0 ], sprops[ 1 ], sprops[ 2 ] ).multiply( currentScope.state.transform );

					}

					continue;

				}

				res = this.surfaceRegex.exec( line );
				if ( res != null ) {

					var sprops = [];
					res[ 2 ].match( this.floatRegex ).forEach( ( x ) => {

						sprops.push( parseFloat( x ) );

					} );

					currentScope.state.surface = sprops;
					continue;

				}

				res = this.ambientRegex.exec( line );
				if ( res != null ) {

					currentScope.state.surface[ 0 ] = parseFloat( res[ 2 ] );
					continue;

				}

				res = this.diffuseRegex.exec( line );
				if ( res != null ) {

					currentScope.state.surface[ 1 ] = parseFloat( res[ 2 ] );
					continue;

				}

				res = this.specularRegex.exec( line );
				if ( res != null ) {

					currentScope.state.surface[ 2 ] = parseFloat( res[ 2 ] );
					continue;

				}

				res = this.materialModeRegex.exec( line );
				if ( res != null ) {

					const matMode = res[ 4 ].toLowerCase();

					if ( matMode == "none" ) {

						currentScope.state.materialmode = MaterialMode.NONE;

					} else if ( matMode == "null" ) {

						currentScope.state.materialmode = MaterialMode.NULL;

					} else if ( matMode == "double" ) {

						currentScope.state.materialmode = MaterialMode.DOUBLE;

					}

					continue;

				}

                res = this.collisionRegex.exec( line );
				if ( res != null ) {

					const collision = res[ 2 ].toLowerCase();

					if ( collision == "on" ) {

						currentScope.state.collision = true;

					} else if ( collision == "off" ) {

						currentScope.state.collision = false;

					}

					continue;

				}

			}

			var geometry = new Geometry();

			var [ vertices, uvs ] = gatherVerticesRecursive( rwxClumpStack[ 0 ].clumps[ 0 ] );

			geometry.vertices.push( ...vertices );

			var materialMap = makeMaterialsRecursive( rwxClumpStack[ 0 ].clumps[ 0 ], textureFolderPath, {}, this.texExtension, this.maskExtension, this.jsZip, this.jsZipUtils );

			var materialsList = [];

			// make a material list
			var i = 0;
			Object.keys( materialMap ).forEach( ( key ) => {

				materialsList.push( materialMap[ key ] );

				// replace map entries with corresponding ids in materialList
				materialMap[ key ] = i ++;

			} );

			var [ faces, loops, loopSignatures, offset ]: any[] = gatherFacesRecursive( rwxClumpStack[ 0 ].clumps[ 0 ],
				materialMap );
			geometry.faces.push( ...faces );

			var [ newVertices, newUvs, newFaces ] = triangulateFacesWithShapes( geometry.vertices, uvs, loops,
				loopSignatures );
			geometry.vertices.push( ...newVertices );
			geometry.faces.push( ...newFaces );
			uvs.push( ...newUvs );

			geometry.faceVertexUvs[ 0 ] = [];

			for ( var i = 0; i < geometry.faces.length; i ++ ) {

				var vid1 = geometry.faces[ i ].a;
				var vid2 = geometry.faces[ i ].b;
				var vid3 = geometry.faces[ i ].c;

				geometry.faceVertexUvs[ 0 ].push( [
					new Vector2( uvs[ vid1 ][ 0 ], uvs[ vid1 ][ 1 ] ),
					new Vector2( uvs[ vid2 ][ 0 ], uvs[ vid2 ][ 1 ] ),
					new Vector2( uvs[ vid3 ][ 0 ], uvs[ vid3 ][ 1 ] )
				] );

			}

			geometry.uvsNeedUpdate = true;
			geometry.computeVertexNormals();

			const object = new Mesh( geometry, materialsList );

			return object;

		}
	} );

	return RWXLoader;

} )();

export {
	RWXLoader
};
