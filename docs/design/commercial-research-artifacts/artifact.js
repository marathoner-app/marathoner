const conceptForms = document.querySelectorAll('[data-concept-form]')

for (const form of conceptForms) {
  form.addEventListener('submit', (event) => {
    event.preventDefault()

    const status = form.querySelector('[role="status"]')
    const selection = form.querySelector('input[type="radio"]:checked')

    if (!(status instanceof HTMLElement)) {
      return
    }

    if (!(selection instanceof HTMLInputElement)) {
      status.textContent = 'Choose a fictional response before continuing.'
      return
    }

    const choice = selection.value || 'Fictional response selected'

    status.textContent = `${choice}. Recorded only in this browser view; nothing was saved or sent.`
  })
}
