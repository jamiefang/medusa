import {
  Vector3,
  ShaderMaterial,
  BufferAttribute,
  TextureLoader,
  BufferGeometry,
  Color,
  Points,
  AdditiveBlending
} from '../../../vendor/three/Three'

import TextureHelper from '../../TextureHelper'

// shaders
import FragmentShader from './shaders/node.frag'
import VertexShader from './shaders/node.vert'
import PickFragmentShader from './shaders/pick.frag'

// images
import spriteFile from '../../../assets/images/dot.png'
import spriteBlurFile from '../../../assets/images/dot-blur.png'
import spriteUpdatedFile from '../../../assets/images/dot-concentric.png'

export default class NodeGeometry {
  constructor (config) {
    this.config = config
    this.nodeCount = config.FDG.nodeCount
    this.textureHelper = new TextureHelper()

    this.sprite = new TextureLoader().load(spriteFile)
    this.spriteBlur = new TextureLoader().load(spriteBlurFile)
    this.uSprite = new TextureLoader().load(spriteUpdatedFile)
    this.decayTime = 0.0
    this.material = null
    this.pickingMaterial = null
    this.geometry = null
    this.baseScale = 15000
    this.lastHoveredID = -1

    for (let index = 0; index < this.config.FDG.colorPalette.length; index++) {
      this.config.FDG.colorPalette[index] = new Color(this.config.FDG.colorPalette[index])
    }
    this.baseColor = this.config.FDG.colorPalette[0]
  }

  setTextureLocations (
    nodeData,
    nodeCount,
    positionArray,
    colorArray,
    pickingColors
  ) {
    let pickColor = new Color(0x999999)

    for (let i = 0; i < nodeCount; i++) {
      const node = nodeData[i]

      pickColor.setHex(i + 1)
      pickingColors.array[i * 3] = pickColor.r
      pickingColors.array[i * 3 + 1] = pickColor.g
      pickingColors.array[i * 3 + 2] = pickColor.b

      if (!node) {
        positionArray[i * 3] = 9999999
        positionArray[i * 3 + 1] = 9999999
        colorArray[i * 4] = 0
        colorArray[i * 4 + 1] = 0
        colorArray[i * 4 + 2] = 0
        colorArray[i * 4 + 3] = 0
        continue
      }

      // texture locations
      let textureLocation = this.textureHelper.getNodeTextureLocation(i)
      positionArray[i * 3] = textureLocation.x
      positionArray[i * 3 + 1] = textureLocation.y

      if (this.config.FDG.cycleColors) {
        colorArray[i * 4] = this.baseColor.r
        colorArray[i * 4 + 1] = this.baseColor.g
        colorArray[i * 4 + 2] = this.baseColor.b
      } else {
        // get color for parent directory
        if (node.p === '/') {
          colorArray[i * 4] = this.baseColor.r
          colorArray[i * 4 + 1] = this.baseColor.g
          colorArray[i * 4 + 2] = this.baseColor.b
          colorArray[i * 4 + 3] = 1
          continue
        }

        let dirArray = node.p.split('/')

        if (node.t === 'f' && dirArray.length === 1) {
          colorArray[i * 4] = this.baseColor.r
          colorArray[i * 4 + 1] = this.baseColor.g
          colorArray[i * 4 + 2] = this.baseColor.b
          colorArray[i * 4 + 3] = 1
          continue
        }

        let dir
        if (node.t === 'd') {
          dir = dirArray[dirArray.length - 1]
        } else {
          dir = dirArray[dirArray.length - 2]
        }

        if (typeof dir === 'undefined') {
          dir = dirArray[0]
        }

        let dirNumber = 0
        for (let charIndex = 0; charIndex < dir.length; charIndex++) {
          dirNumber += dir[charIndex].charCodeAt(0)
        }

        let dirIdentifier = dirNumber % (this.config.FDG.colorPalette.length - 1)

        let nodeColor = this.config.FDG.colorPalette[dirIdentifier]

        colorArray[i * 4 + 0] = nodeColor.r
        colorArray[i * 4 + 1] = nodeColor.g
        colorArray[i * 4 + 2] = nodeColor.b
      }

      // store time since last update in alpha channel
      if (node.u) {
        colorArray[i * 4 + 3] = 0.0
      } else {
        colorArray[i * 4 + 3] += this.config.FDG.colorCooldownSpeed
      }
    }
  }

  create (nodeData, nodeCount) {
    this.textureHelper.setTextureSize(nodeCount)

    if (this.geometry) {
      this.geometry.dispose()
    }

    this.geometry = new BufferGeometry()
    this.pickingGeometry = new BufferGeometry()

    let positionArray = new Float32Array(nodeCount * 3)
    let colorArray = new Float32Array(nodeCount * 4)

    // picking geometry attributes
    let pickingColors = new BufferAttribute(new Float32Array(nodeCount * 3), 3)
    let isHovered = new BufferAttribute(new Float32Array(nodeCount), 1)
    let isSelected = new BufferAttribute(new Float32Array(nodeCount), 1)

    this.setTextureLocations(
      nodeData,
      nodeCount,
      positionArray,
      colorArray,
      pickingColors
    )

    let position = new BufferAttribute(positionArray, 3)
    let color = new BufferAttribute(colorArray, 4)

    this.geometry.addAttribute('position', position)
    this.geometry.addAttribute('color', color)
    this.geometry.addAttribute('isHovered', isHovered)
    this.geometry.addAttribute('isSelected', isSelected)

    let idArray = new Float32Array(nodeCount)
    for (let index = 0; index < idArray.length; index++) {
      idArray[index] = index
    }

    let id = new BufferAttribute(idArray, 1)
    this.geometry.addAttribute('id', id)

    this.pickingGeometry.addAttribute('position', position)
    this.pickingGeometry.addAttribute('pickerColor', pickingColors)
    this.pickingGeometry.addAttribute('id', id)

    if (!this.material) {
      const uniforms = {
        camDistToCenter: {
          type: 'f',
          value: null
        },
        cycleColors: {
          type: 'f',
          value: this.config.cycleColors ? 1.0 : 0.0
        },
        map: {
          type: 't',
          value: this.sprite
        },
        mapBlur: {
          type: 't',
          value: this.spriteBlur
        },
        uMap: {
          type: 't',
          value: this.uSprite
        },
        decayTime: {
          type: 'f',
          value: null
        },
        uTime: {
          type: 'f',
          value: null
        },
        positionTexture: {
          type: 't',
          value: null
        },
        scale: {
          type: 'f',
          value: this.baseScale
        },
        nodeIsHovered: {
          type: 'f',
          value: 0.0
        },
        nodeIsSelected: {
          type: 'f',
          value: 0.0
        }
      }

      this.material = new ShaderMaterial({
        uniforms: uniforms,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        vertexShader: VertexShader,
        fragmentShader: FragmentShader
      })

      this.pickingMaterial = new ShaderMaterial({
        uniforms: uniforms,
        depthTest: true,
        transparent: false,
        vertexShader: VertexShader,
        fragmentShader: PickFragmentShader
      })
    }

    this.resize()

    this.pickingMesh = new Points(this.pickingGeometry, this.pickingMaterial)
    this.nodes = new Points(this.geometry, this.material)

    this.nodes.geometry.setDrawRange(0, nodeData.length)
    this.pickingMesh.geometry.setDrawRange(0, nodeData.length)

    return this.nodes
  }

  getPickingMesh () {
    return this.pickingMesh
  }

  setDecayTime (time) {
    this.decayTime = time
  }

  resize () {
    if (this.material) {
      this.material.uniforms.scale.value = this.baseScale * (Math.min(this.config.scene.width, this.config.scene.height) * 0.001)
    }
  }

  update (camera, frame) {
    this.decayTime++
    this.material.uniforms.decayTime.value = this.decayTime
    this.material.uniforms.uTime.value = frame

    let camPos = camera.getWorldPosition(new Vector3())
    const center = new Vector3(0.0, 0.0, 0.0)
    this.material.uniforms.camDistToCenter.value = camPos.distanceTo(center)
  }
}
