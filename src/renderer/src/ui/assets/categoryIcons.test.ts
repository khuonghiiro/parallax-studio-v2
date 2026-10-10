import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderCategoryIcon } from './categoryIcons'
import {
  IconArmchair,
  IconCube,
  IconDecor,
  IconGrid,
  IconGrid3D,
  IconHome,
  IconLayersStack,
  IconPropLamp,
  IconTree,
  IconUser,
  IconUserFemale,
  IconUserMale
} from '../icons'

describe('renderCategoryIcon', () => {
  it('renders specific icons for nature, character, room and decor', () => {
    const tree = renderCategoryIcon('tree') as React.ReactElement
    expect(tree.type).toBe(IconTree)

    const user = renderCategoryIcon('user') as React.ReactElement
    expect(user.type).toBe(IconUser)

    const room = renderCategoryIcon('room') as React.ReactElement
    expect(room.type).toBe(IconArmchair)

    const decor = renderCategoryIcon('decor') as React.ReactElement
    expect(decor.type).toBe(IconDecor)

    const layers = renderCategoryIcon('layers') as React.ReactElement
    expect(layers.type).toBe(IconLayersStack)

    const cube = renderCategoryIcon('cube') as React.ReactElement
    expect(cube.type).toBe(IconCube)

    const home = renderCategoryIcon('home') as React.ReactElement
    expect(home.type).toBe(IconHome)
  })

  it('differentiates character gender and semantic icons without duplication', () => {
    const male = renderCategoryIcon('user-male') as React.ReactElement
    const female = renderCategoryIcon('user-female') as React.ReactElement
    const hero = renderCategoryIcon('character_hero') as React.ReactElement
    const anime = renderCategoryIcon('character_anime') as React.ReactElement

    expect(male.type).toBe(IconUserMale)
    expect(female.type).toBe(IconUserFemale)
    expect(hero.type).toBe(IconUserMale)
    expect(anime.type).toBe(IconUserFemale)
    expect(male.type).not.toBe(female.type)

    const grid3d = renderCategoryIcon('grid-3d') as React.ReactElement
    const cube = renderCategoryIcon('cube') as React.ReactElement
    const prop = renderCategoryIcon('prop') as React.ReactElement

    expect(grid3d.type).toBe(IconGrid3D)
    expect(cube.type).toBe(IconCube)
    expect(prop.type).toBe(IconPropLamp)
    expect(grid3d.type).not.toBe(cube.type)
    expect(prop.type).not.toBe(cube.type)

    // Kiểm tra tự động phân giải giới tính ngay cả khi icon truyền vào là 'user' chung chung
    const resolvedHero = renderCategoryIcon('user', 16, 16, 'character_hero') as React.ReactElement
    const resolvedAnime = renderCategoryIcon('user', 16, 16, 'character_anime') as React.ReactElement
    expect(resolvedHero.type).toBe(IconUserMale)
    expect(resolvedAnime.type).toBe(IconUserFemale)
    expect(resolvedHero.type).not.toBe(resolvedAnime.type)
  })

  it('renders fallback grid icon for unknown keys', () => {
    const unknown = renderCategoryIcon('unknown_key_xyz') as React.ReactElement
    expect(unknown.type).toBe(IconGrid)
  })
})

