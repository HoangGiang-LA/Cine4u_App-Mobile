import {describe, expect, it} from 'vitest'
import {firebaseEnvironment} from '../firebase/environment'
import {firebaseConfig} from '../firebase/config'

describe('local Firebase isolation', () => {
  it('keeps the original config unless local mode is explicitly enabled', () => {
    expect(firebaseEnvironment(undefined, true)).toEqual({local: false, config: firebaseConfig})
    expect(firebaseEnvironment('false', false).config).toEqual(firebaseConfig)
  })
  it('uses a demo project without production resources', () => {
    const {config, local} = firebaseEnvironment('true', true)
    expect(local).toBe(true)
    expect(config.projectId).toBe('demo-englishbattle')
    expect(config.databaseURL).toBe('https://demo-englishbattle-default-rtdb.firebaseio.com')
    expect(config.measurementId).toBeUndefined()
    expect(config.storageBucket).toBeUndefined()
  })
  it('refuses local mode in production builds and invalid flags', () => {
    expect(() => firebaseEnvironment('true', false)).toThrow()
    expect(() => firebaseEnvironment('yes', true)).toThrow()
  })
})
