import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifactDirectory = resolve(
  repositoryRoot,
  'docs/design/commercial-research-artifacts',
)

const artifactFiles = ['readiness-result.html', 'adaptation-decision.html']
const artifactVersion = 'commercial-research-artifacts@0.1.0'

const readArtifact = (fileName) =>
  readFileSync(resolve(artifactDirectory, fileName), 'utf8')

const parseArtifact = (fileName) => new JSDOM(readArtifact(fileName))

describe('commercial research artifacts', () => {
  for (const fileName of artifactFiles) {
    it(`${fileName} preserves the fictional, local-only boundary`, () => {
      const source = readArtifact(fileName)
      const { document } = parseArtifact(fileName).window
      const pageText = document.body.textContent.replace(/\s+/g, ' ').trim()

      expect(
        document.querySelector('meta[name="artifact-version"]')?.getAttribute('content'),
      ).toBe(artifactVersion)
      expect(pageText).toMatch(/fictional research concept/i)
      expect(pageText).toMatch(/not (?:a real readiness result|a training recommendation)/i)
      expect(pageText).toMatch(/not (?:a training plan|medical guidance)/i)
      expect(source).not.toMatch(/https?:\/\//i)

      const policy = document
        .querySelector('meta[http-equiv="Content-Security-Policy"]')
        ?.getAttribute('content')

      expect(policy).toContain("connect-src 'none'")
      expect(policy).toContain("form-action 'none'")
    })

    it(`${fileName} has a semantic, keyboard-operable decision form`, () => {
      const { document } = parseArtifact(fileName).window

      expect(document.querySelectorAll('main')).toHaveLength(1)
      expect(document.querySelectorAll('h1')).toHaveLength(1)
      expect(document.querySelector('a.skip-link')?.getAttribute('href')).toBe(
        '#main-content',
      )
      expect(document.querySelector('[role="note"]')).not.toBeNull()
      expect(document.querySelector('form[data-concept-form] fieldset legend')).not.toBeNull()
      expect(document.querySelector('button[type="submit"]')).not.toBeNull()
      expect(document.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull()

      for (const list of document.querySelectorAll(
        '.artifact-switcher, .fact-list, .timeline, .option-list',
      )) {
        expect(list.getAttribute('role')).toBe('list')
        expect([...list.children].every((item) => item.getAttribute('role') === 'listitem')).toBe(
          true,
        )
      }

      const choices = [...document.querySelectorAll('input[type="radio"]')]
      expect(choices.length).toBeGreaterThanOrEqual(3)
      expect(choices.every((choice) => !choice.hasAttribute('checked'))).toBe(true)
      expect(
        choices.every((choice) => document.querySelector(`label[for="${choice.id}"]`)),
      ).toBe(true)
    })

    it(`${fileName} avoids prohibited claim language`, () => {
      const pageText = parseArtifact(fileName).window.document.body.textContent
        .replace(/\s+/g, ' ')
        .trim()

      const prohibitedClaims = [
        /will prevent (?:an )?injury/i,
        /guarantee(?:d|s)? (?:a )?(?:finish|result|safety)/i,
        /safe for you/i,
        /medically safe/i,
        /you should (?:run|hold|repeat|reschedule)/i,
      ]

      for (const prohibitedClaim of prohibitedClaims) {
        expect(pageText).not.toMatch(prohibitedClaim)
      }
    })
  }

  it('readiness concept exposes evidence, uncertainty, and a next decision', () => {
    const pageText = parseArtifact('readiness-result.html').window.document.body.textContent
      .replace(/\s+/g, ' ')
      .trim()

    expect(pageText).toMatch(/Evidence this concept considered/i)
    expect(pageText).toMatch(/What this concept does not know/i)
    expect(pageText).toMatch(/Uncertainty remains explicit/i)
    expect(pageText).toMatch(/What should this concept show next/i)
  })

  it('adaptation concept exposes every bounded option, reason, consequence, and approval', () => {
    const pageText = parseArtifact('adaptation-decision.html').window.document.body.textContent
      .replace(/\s+/g, ' ')
      .trim()

    for (const option of [
      'Reschedule',
      'Hold',
      'Repeat',
      'Reconsider',
      'Keep as planned',
    ]) {
      expect(pageText).toContain(option)
    }

    expect(pageText).toMatch(/work trip conflicts with Thursday/i)
    expect(pageText).toMatch(/Only easy session B moves from Thursday to Friday/i)
    expect(pageText).toMatch(/Nothing changes until a choice is made/i)
    expect(pageText).toMatch(/Approval required/i)
  })

  it('interaction reports a choice without persistence or network behavior', () => {
    const dom = new JSDOM(readArtifact('adaptation-decision.html'), {
      runScripts: 'outside-only',
    })
    const script = readFileSync(resolve(artifactDirectory, 'artifact.js'), 'utf8')

    expect(script).not.toMatch(/localStorage|sessionStorage|indexedDB/i)
    expect(script).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/i)

    dom.window.eval(script)

    const form = dom.window.document.querySelector('form[data-concept-form]')
    const choice = dom.window.document.querySelector('#adapt-keep')
    const status = dom.window.document.querySelector('[role="status"]')

    choice.checked = true
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))

    expect(status.textContent).toContain('Keep the fictional schedule unchanged')
    expect(status.textContent).toContain('nothing was saved or sent')
  })

  it('shared styles preserve responsive, focus, target-size, and reduced-motion behavior', () => {
    const styles = readFileSync(resolve(artifactDirectory, 'artifact.css'), 'utf8')

    expect(styles).toMatch(/:focus-visible/)
    expect(styles).toMatch(/min-height:\s*4[4-9]px/)
    expect(styles).toMatch(/@media \(max-width: 720px\)/)
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})
