import { describe, expect, it } from 'vitest'
import { renderCategoryIcon } from './categoryIcons'

describe('renderCategoryIcon', () => {
  it('renders specific icons for nature, character, room and decor', () => {
    const tree = renderCategoryIcon('tree')
    expect(tree).toBeDefined()

    const user = renderCategoryIcon('user')
    expect(user).toBeDefined()

    const character = renderCategoryIcon('character')
    expect(character).toBeDefined()

    const room = renderCategoryIcon('room')
    expect(room).toBeDefined()

    const decor = renderCategoryIcon('decor')
    expect(decor).toBeDefined()

    const layers = renderCategoryIcon('layers')
    expect(layers).toBeDefined()

    const cube = renderCategoryIcon('cube')
    expect(cube).toBeDefined()

    const home = renderCategoryIcon('home')
    expect(home).toBeDefined()
  })

  it('renders fallback grid icon for unknown keys', () => {
    const unknown = renderCategoryIcon('unknown_key_xyz')
    expect(unknown).toBeDefined()
  })
})
