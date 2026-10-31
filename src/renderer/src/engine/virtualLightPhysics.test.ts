import { describe, expect, it } from 'vitest'
import { createProject, createShot, createSolidLayer } from '../project/factory'
import {
  attachLogicNodeToLayerV2,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId
} from '../project/workflowV2Engine'
import {
  collectActiveVirtualLights,
  computeUnified25DLightAtOffset,
  createDefaultVirtualLight,
  evaluateCaveDepthPortalForLayer,
  evaluateVirtualLightAtTime,
  hexToRgb01,
  resolveReceivedVirtualLightForLayer
} from './virtualLight'
import { computePhysicalRayStriation } from './virtualLightPhysics'

describe('2.5D Physical Light Dynamics & Environmental Projection', () => {
  it('models candle aerodynamics across calm, gentle, strong and storm wind with blackbody thermal shifts', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const candle = createSolidLayer(project.comp)
    candle.props.width = 160
    candle.props.height = 240
    candle.virtualLight = {
      ...createDefaultVirtualLight('candle'),
      color: '#ff9d3b',
      intensity: 1.0,
      windDirectionDeg: 0
    }

    const sampleSeries = (preset: 'none' | 'gentle' | 'strong' | 'storm') => {
      candle.virtualLight!.windPreset = preset
      const samples = []
      for (let i = 0; i <= 40; i++) {
        const ev = evaluateVirtualLightAtTime(candle, i * 0.08)!
        samples.push(ev)
      }
      return samples
    }

    // 1. Lặng gió: đứng thẳng đối lưu (+Y), vẫn có nhấp nháy vi mô sống động (~4-10%), không phẳng cứng
    const calm = sampleSeries('none')
    const calmI = calm.map((s) => s.effectiveIntensity)
    const calmRange = Math.max(...calmI) - Math.min(...calmI)
    expect(calmRange).toBeGreaterThan(0.015)
    expect(calmRange).toBeLessThan(0.22)
    expect(calm[0].beamDir[1]).toBeGreaterThan(0.05)
    expect(Math.abs(calm[0].beamDir[0])).toBeLessThan(0.01)

    // 2. Gió nhẹ: lửa nghiêng xuôi chiều gió (+X), quầng sáng xuôi gió vươn dài hơn ngược gió
    const gentle = sampleSeries('gentle')
    const avgGentleX = gentle.reduce((s, e) => s + e.windOffset[0], 0) / gentle.length
    expect(avgGentleX).toBeGreaterThan(4)
    const g0 = gentle[5]
    const downwindHalo = computeUnified25DLightAtOffset(
      180,
      20,
      g0.effectiveRadius,
      g0.effectiveIntensity,
      g0.coneCos,
      g0.beamDir,
      g0.softness,
      g0.beamCurvature,
      0,
      g0.hotspotFocus
    ).localLightHalo
    const upwindHalo = computeUnified25DLightAtOffset(
      -180,
      20,
      g0.effectiveRadius,
      g0.effectiveIntensity,
      g0.coneCos,
      g0.beamDir,
      g0.softness,
      g0.beamCurvature,
      0,
      g0.hotspotFocus
    ).localLightHalo
    expect(downwindHalo).toBeGreaterThan(upwindHalo * 1.25)

    // 3. Gió mạnh & Bão: dao động biên độ lớn hơn gió nhẹ + dịch chuyển nhiệt màu Blackbody theo sụt/bùng oxy
    const strong = sampleSeries('strong')
    const storm = sampleSeries('storm')
    const gentleRange = Math.max(...gentle.map((s) => s.effectiveIntensity)) - Math.min(...gentle.map((s) => s.effectiveIntensity))
    const strongRange = Math.max(...strong.map((s) => s.effectiveIntensity)) - Math.min(...strong.map((s) => s.effectiveIntensity))
    const stormMin = Math.min(...storm.map((s) => s.effectiveIntensity))
    expect(strongRange).toBeGreaterThan(gentleRange * 1.2)
    expect(stormMin).toBeLessThan(0.45)

    const baseRgb = hexToRgb01('#ff9d3b')
    const baseBlueRatio = baseRgb[2] / baseRgb[0]
    const darkestSample = [...strong, ...storm].reduce((a, b) => (a.effectiveIntensity < b.effectiveIntensity ? a : b))
    const brightestSample = [...strong, ...storm].reduce((a, b) => (a.effectiveIntensity > b.effectiveIntensity ? a : b))
    expect(darkestSample.rgb[2] / darkestSample.rgb[0]).toBeLessThan(baseBlueRatio)
    expect(brightestSample.rgb[2] / brightestSample.rgb[0]).toBeGreaterThan(darkestSample.rgb[2] / darkestSample.rgb[0])
  })

  it('models flashlight behavior modes (steady, breathing, intermittent) plus dual-zone hotspot and Tyndall rays', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const torch = createSolidLayer(project.comp)
    torch.virtualLight = {
      ...createDefaultVirtualLight('flashlight'),
      intensity: 1.2,
      flickerSpeed: 1.1,
      pulseDepth: 0.55
    }

    const collectI = (mode: 'steady' | 'breathing' | 'intermittent') => {
      torch.virtualLight!.behaviorMode = mode
      const vals: number[] = []
      for (let i = 0; i <= 60; i++) {
        vals.push(evaluateVirtualLightAtTime(torch, i * 0.07)!.effectiveIntensity)
      }
      return vals
    }

    const steadyI = collectI('steady')
    const breatheI = collectI('breathing')
    const interI = collectI('intermittent')

    expect(Math.max(...steadyI) - Math.min(...steadyI)).toBeLessThan(0.08)
    expect(Math.max(...breatheI)).toBeGreaterThan(1.32)
    expect(Math.min(...breatheI)).toBeLessThan(1.05)
    // Đèn pin chập chờn pin yếu: có đợt sáng chuẩn ~1.2 xen kẽ cụm sụt áp sâu < 0.75
    expect(Math.max(...interI)).toBeGreaterThan(1.12)
    expect(Math.min(...interI)).toBeLessThan(0.75)

    // Quang học 2 vùng Hotspot vs Spill + Tỉa tia sáng Tyndall ra môi trường
    const coneCos = Math.cos((52 * 0.5 * Math.PI) / 180)
    const tightCenter = computeUnified25DLightAtOffset(0, -240, 760, 1.2, coneCos, [0, -1], 0.42, 0.2, 0, 0.88).coneAtten
    const wideCenter = computeUnified25DLightAtOffset(0, -240, 760, 1.2, coneCos, [0, -1], 0.42, 0.2, 0, 0.12).coneAtten
    expect(tightCenter).toBeGreaterThan(wideCenter)

    const rayFactors: number[] = []
    for (let deg = -22; deg <= 22; deg += 2) {
      const rad = ((deg - 90) * Math.PI) / 180
      const dx = Math.cos(rad) * 320
      const dy = Math.sin(rad) * 320
      const res = computeUnified25DLightAtOffset(dx, dy, 760, 1.2, coneCos, [0, -1], 0.42, 0.2, 0, 0.6, 0.75, 9, 0.4)
      rayFactors.push(res.rayFactor)
    }
    expect(Math.max(...rayFactors) - Math.min(...rayFactors)).toBeGreaterThan(0.25)
  })

  it('projects environmental bounce onto wide off-center layers, respects directional cones, and deduplicates 2.5D clusters', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Phòng nến', [0, 0, 0], 0)
    project.shots.push(shot)

    // Tường nền rộng 1920x1080 ở tâm (0, 0), ngọn nến đặt lệch hẳn sang mép trái (-640, 60) với bán kính 460
    const wideWall = createSolidLayer(project.comp)
    wideWall.shotId = shot.id
    wideWall.props.width = 1920
    wideWall.props.height = 1080
    wideWall.transform.position.value = [0, 0, 120]

    // Cụm nhân vật 3 mảnh cùng mang virtualLight (mô phỏng gắn Light Node lên Khoá Cụm 2.5D)
    const makePart = (name: string, isRoot: boolean) => {
      const p = createSolidLayer(project.comp)
      p.name = name
      p.shotId = shot.id
      p.transform.position.value = [-640, 60, 20]
      p.composite = {
        compositeId: 'comp-candle-holder',
        compositeName: 'Người cầm nến',
        instanceId: 'inst-holder-1',
        partGroupId: name,
        lockedGroup: true,
        isRoot
      }
      p.virtualLight = {
        ...createDefaultVirtualLight('candle'),
        intensity: 1.25,
        radius: 460,
        envBounce: 1.0
      }
      return p
    }
    const rootPart = makePart('body', true)
    const armPart = makePart('arm', false)
    const headPart = makePart('head', false)
    project.layers.push(wideWall, rootPart, armPart, headPart)

    // 1. Khử trùng lặp cụm: chỉ phát 1 nguồn sáng duy nhất từ rootPart thay vì chồng 3 lần
    const activeLights = collectActiveVirtualLights(project, shot.id, 1.0)
    expect(activeLights).toHaveLength(1)
    expect(activeLights[0].sourceLayerId).toBe(rootPart.id)

    // 2. Tường rộng lệch tâm vẫn nhận ánh xạ ấm áp tại vùng bề mặt gần ngọn nến
    const wallBounce = evaluateCaveDepthPortalForLayer(project, wideWall, [0, 0, 120], 1.0)
    expect(wallBounce.lightIllumination).toBeGreaterThan(0.15)

    // Khi tắt Ánh xạ nền (envBounce = 0), tường không còn bị hắt sáng
    rootPart.virtualLight!.envBounce = 0
    const wallNoBounce = evaluateCaveDepthPortalForLayer(project, wideWall, [0, 0, 120], 1.0)
    expect(wallNoBounce.lightIllumination).toBe(0)

    // 3. Đèn pin định hướng quay lưng đi chỗ khác không chiếm nhầm kênh chiếu sáng của đèn rọi trúng vật thể
    const prop = createSolidLayer(project.comp)
    prop.shotId = shot.id
    prop.props.width = 220
    prop.props.height = 220
    prop.transform.position.value = [300, 0, 0]

    const awayTorch = createSolidLayer(project.comp)
    awayTorch.shotId = shot.id
    awayTorch.transform.position.value = [160, 0, 0]
    awayTorch.virtualLight = {
      ...createDefaultVirtualLight('flashlight'),
      intensity: 1.8,
      radius: 800,
      beamAngleDeg: 180, // Quay ngược sang trái, lưng quay về prop ở X=300
      coneAngleDeg: 45
    }

    const aimedTorch = createSolidLayer(project.comp)
    aimedTorch.shotId = shot.id
    aimedTorch.transform.position.value = [-50, 0, 0]
    aimedTorch.virtualLight = {
      ...createDefaultVirtualLight('flashlight'),
      intensity: 1.1,
      radius: 800,
      beamAngleDeg: 0, // Rọi thẳng sang phải trúng prop ở X=300
      coneAngleDeg: 48
    }

    const evAway = evaluateVirtualLightAtTime(awayTorch, 1.0)!
    const evAimed = evaluateVirtualLightAtTime(aimedTorch, 1.0)!
    const received = resolveReceivedVirtualLightForLayer(prop.id, [300, 0, 0], 220, 220, 0, [evAway, evAimed])
    expect(received).not.toBeNull()
    expect(received!.light.sourceLayerId).toBe(aimedTorch.id)
  })

  it('round-trips Workflow V2 Light Node timing [timeStart, timeEnd], mode switches, and behavior params cleanly', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 8 })
    const shot = createShot('Cảnh Đêm', [0, 0, 0], 0)
    project.shots = [shot]
    const lamp = createSolidLayer(project.comp)
    lamp.shotId = shot.id
    lamp.inPoint = 0
    lamp.outPoint = 8
    project.layers = [lamp]

    let wf = syncWorkflowV2Graph(project)
    const attached = attachLogicNodeToLayerV2(wf, v2LayerNodeId(lamp.id), 'light', 'v2:light:candle')
    wf = attached.workflow
    project.workflow = wf

    const lightNode = wf.nodes.find((n) => n.id === attached.createdNodeId)!
    syncWorkflowV2NodeToProject(project, lightNode)
    expect(lamp.virtualLight?.kind).toBe('candle')

    // Chuyển từ Ngọn nến (360°) sang Đèn pin (chùm nón) + đặt khoảng sáng 1.5s..4.5s + chế độ chập chờn pin yếu
    syncWorkflowV2NodeToProject(project, lightNode, {
      lightMode: 'spot',
      lightBehavior: 'intermittent',
      lightRayIntensity: 0.68,
      lightEnvBounce: 1.15,
      timeStart: 1.5,
      timeEnd: 4.5
    })
    lightNode.params = {
      ...lightNode.params,
      lightMode: 'spot',
      lightBehavior: 'intermittent',
      lightRayIntensity: 0.68,
      lightEnvBounce: 1.15,
      timeStart: 1.5,
      timeEnd: 4.5
    }

    expect(lamp.virtualLight?.kind).toBe('flashlight')
    expect(lamp.virtualLight?.coneAngleDeg).toBe(52)
    expect(lamp.virtualLight?.behaviorMode).toBe('intermittent')
    expect(lamp.virtualLight?.startTime).toBe(1.5)
    expect(lamp.virtualLight?.duration).toBe(3)

    // Ngoài khung [1.5s, 4.5s] đèn tắt hoàn toàn; trong khung đèn bật sáng
    expect(evaluateVirtualLightAtTime(lamp, 0.8)).toBeNull()
    expect(evaluateVirtualLightAtTime(lamp, 2.5)).not.toBeNull()
    expect(evaluateVirtualLightAtTime(lamp, 5.2)).toBeNull()

    // Đồng bộ ngược lại Workflow V2 Graph giữ nguyên chính xác mốc thời gian & cấu hình vật lý
    const resynced = syncWorkflowV2Graph(project, project.workflow)
    const derivedLight = resynced.nodes.find((n) => n.id === lightNode.id)!
    expect(derivedLight.params?.lightMode).toBe('spot')
    expect(derivedLight.params?.timeStart).toBe(1.5)
    expect(derivedLight.params?.timeEnd).toBe(4.5)
    expect(derivedLight.params?.lightBehavior).toBe('intermittent')
    expect(derivedLight.params?.lightRayIntensity).toBe(0.68)
    expect(derivedLight.params?.lightEnvBounce).toBe(1.15)
  })

  it('alternates dynamic stochastic ray directions every ~1s while keeping static rays fixed', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const lantern = createSolidLayer(project.comp)
    lantern.virtualLight = {
      ...createDefaultVirtualLight('candle'),
      rayIntensity: 0.85,
      rayCount: 12,
      rayDynamic: true
    }

    // 1. Khi rayDynamic = false: giá trị tia sáng tại mọi thời điểm là cố định 100%
    lantern.virtualLight.rayDynamic = false
    const static0 = evaluateVirtualLightAtTime(lantern, 0.0)!
    const static1 = evaluateVirtualLightAtTime(lantern, 1.0)!
    expect(static0.rayAnimPhase).toBe(0)
    expect(static1.rayAnimPhase).toBe(0)
    const factorStatic0 = computePhysicalRayStriation(0.5, 0.5, 0.85, 12, static0.rayAnimPhase, false)
    const factorStatic1 = computePhysicalRayStriation(0.5, 0.5, 0.85, 12, static1.rayAnimPhase, false)
    expect(factorStatic0).toBe(factorStatic1)

    // 2. Khi rayDynamic = true: sau 1s (t=0.05s vs t=1.05s vs t=2.05s), tia đảo sang các góc / vị trí khác
    lantern.virtualLight.rayDynamic = true
    const dyn0 = evaluateVirtualLightAtTime(lantern, 0.05)!
    const dyn1 = evaluateVirtualLightAtTime(lantern, 1.05)!
    const dyn2 = evaluateVirtualLightAtTime(lantern, 2.05)!

    expect(dyn0.rayAnimPhase).toBeGreaterThan(0)
    expect(dyn1.rayAnimPhase).toBeGreaterThan(dyn0.rayAnimPhase)

    // Quét toàn bộ vòng 360° để thu thập profile tia tại từng giây
    const scanAngles = (phase: number) => {
      const vals: number[] = []
      for (let deg = 0; deg < 360; deg += 10) {
        const rad = (deg * Math.PI) / 180
        vals.push(computePhysicalRayStriation(rad, 0.5, 0.85, 12, phase, false))
      }
      return vals
    }

    const raysAtSec0 = scanAngles(dyn0.rayAnimPhase)
    const raysAtSec1 = scanAngles(dyn1.rayAnimPhase)
    const raysAtSec2 = scanAngles(dyn2.rayAnimPhase)

    // Kiểm tra độ khác biệt vị trí tia giữa các giây: các đỉnh tia ở giây 0 và giây 1 phân bố ở góc khác nhau
    let diff01 = 0
    let diff12 = 0
    for (let i = 0; i < raysAtSec0.length; i++) {
      diff01 += Math.abs(raysAtSec0[i] - raysAtSec1[i])
      diff12 += Math.abs(raysAtSec1[i] - raysAtSec2[i])
    }
    expect(diff01 / raysAtSec0.length).toBeGreaterThan(0.08)
    expect(diff12 / raysAtSec1.length).toBeGreaterThan(0.08)

    // 3. Chuyển tiếp liên tục không giật cục tại mốc chuyển giao giây (t = 0.999s vs t = 1.001s)
    const factorPre = computePhysicalRayStriation(0.8, 0.5, 0.85, 12, 0.9999, false)
    const factorPost = computePhysicalRayStriation(0.8, 0.5, 0.85, 12, 1.0001, false)
    expect(Math.abs(factorPre - factorPost)).toBeLessThan(0.01)
  })

  it('controls asymmetric front/back depth reach (zReachFront vs zReachBack) to isolate foreground and background layers', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Cột Đèn', [0, 0, 0], 0)
    project.shots = [shot]

    // Cột đèn đặt ở Z = 250
    const lamp = createSolidLayer(project.comp)
    lamp.shotId = shot.id
    lamp.transform.position.value = [0, 0, 250]
    lamp.virtualLight = {
      ...createDefaultVirtualLight('flashlight'),
      intensity: 1.5,
      radius: 600,
      envBounce: 1.0,
      zReachFront: 1800, // Chiếu mạnh tới 1800px về phía trước (tiền cảnh)
      zReachBack: 150    // Chỉ chiếu tối đa 150px về phía sau (chặn tường/nền ở xa)
    }

    // Layer tiền cảnh (xe scooter) ở Z = 120 (cách 130px về phía trước: 250 - 120 = 130 <= 1800)
    const scooter = createSolidLayer(project.comp)
    scooter.shotId = shot.id
    scooter.transform.position.value = [0, 0, 120]

    // Layer hậu cảnh (bức tường/mặt đường) ở Z = 520 (cách 270px về phía sau: 520 - 250 = 270 > 150)
    const wall = createSolidLayer(project.comp)
    wall.shotId = shot.id
    wall.transform.position.value = [0, 0, 520]

    project.layers = [lamp, scooter, wall]

    const evLamp = evaluateVirtualLightAtTime(lamp, 1.0)!
    expect(evLamp.zReachFront).toBe(1800)
    expect(evLamp.zReachBack).toBe(150)

    // Tiền cảnh (scooter) nhận ánh sáng từ cột đèn
    const receivedFront = resolveReceivedVirtualLightForLayer(scooter.id, [0, 0, 120], 300, 300, 0, [evLamp])
    expect(receivedFront).not.toBeNull()
    expect(receivedFront!.effectiveIntensity).toBeGreaterThan(0.1)

    // Hậu cảnh (wall) bị chặn bởi zReachBack=150, nhận 0 ánh sáng (triệt tiêu viền trắng bị lộ)
    const receivedBack = resolveReceivedVirtualLightForLayer(wall.id, [0, 0, 520], 1920, 540, 0, [evLamp])
    expect(receivedBack).toBeNull()

    // Khi nới rộng zReachBack lên 400px, bức tường mới bắt đầu nhận sáng
    lamp.virtualLight.zReachBack = 400
    const evLampWide = evaluateVirtualLightAtTime(lamp, 1.0)!
    const receivedBackWide = resolveReceivedVirtualLightForLayer(wall.id, [0, 0, 520], 1920, 540, 0, [evLampWide])
    expect(receivedBackWide).not.toBeNull()
  })
})
