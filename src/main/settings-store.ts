import { EventEmitter } from 'node:events'
import Store from 'electron-store'
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type DeepPartial,
  type Settings
} from '@shared/settings'

/**
 * 配置唯一真源。持久化到 userData 下的 JSON，变更时 emit('changed', settings)。
 */
export class SettingsStore extends EventEmitter {
  private readonly store: Store<{ settings: Settings }>

  constructor() {
    super()
    this.store = new Store<{ settings: Settings }>({
      defaults: { settings: DEFAULT_SETTINGS }
    })
  }

  get(): Settings {
    // 与默认值合并，补齐升级后新增的字段
    const raw = this.store.get('settings') as DeepPartial<Settings>
    return mergeSettings(DEFAULT_SETTINGS, raw)
  }

  patch(patch: DeepPartial<Settings>): Settings {
    const next = mergeSettings(this.get(), patch)
    this.store.set('settings', next)
    this.emit('changed', next)
    return next
  }
}
