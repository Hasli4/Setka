export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== undefined && value !== null) {
        element.setAttribute(name, value);
      }
    }
  }

  if (options.children) {
    element.append(...options.children);
  }

  return element;
}

export function clear(element) {
  element.replaceChildren();
}

export function formatDate(value) {
  if (!value) {
    return 'Не указана';
  }

  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

