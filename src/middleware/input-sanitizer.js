function escapeString(value) {
  return value.replace(/[&<>"'`=\/]/g, (char) => {
    switch (char) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      case '`': return '&#x60;'
      case '=': return '&#x3D;'
      case '/': return '&#x2F;'
      default: return char
    }
  })
}

function sanitizeValue(value) {
  if (typeof value !== 'string') return value
  return escapeString(value.trim())
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return sanitizeValue(obj)
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }

  return Object.entries(obj).reduce((acc, [key, value]) => {
    const sanitizedKey = key.replace(/^[.$]+/, '').replace(/\./g, '')
    acc[sanitizedKey] = sanitizeObject(value)
    return acc
  }, {})
}

function sanitizeRequest(req, res, next) {
  req.body = sanitizeObject(req.body)
  req.query = sanitizeObject(req.query)
  req.params = sanitizeObject(req.params)

  if (req.headers['x-user-email']) {
    req.headers['x-user-email'] = sanitizeValue(req.headers['x-user-email'])
  }

  next()
}

module.exports = { sanitizeRequest }