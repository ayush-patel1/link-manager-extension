// Content script for form detection and auto-fill

// Declare chrome variable
const chrome = window.chrome

class ContentManager {
  constructor() {
    this.links = []
    this.settings = {}
    this.init()
  }

  async init() {
    await this.loadData()
    if (this.settings.autoFillForms) {
      this.setupFormDetection()
      this.createFloatingButton()
    }
  }

  async loadData() {
    try {
      const result = await chrome.storage.sync.get(["links", "settings"])
      this.links = result.links || []
      this.settings = result.settings || {}
    } catch (error) {
      console.error("Error loading data in content script:", error)
    }
  }

  setupFormDetection() {
    // Detect URL input fields
    const urlInputs = document.querySelectorAll(
      'input[type="url"], input[name*="url"], input[placeholder*="url"], input[placeholder*="link"], input[id*="url"], input[id*="link"]',
    )

    urlInputs.forEach((input) => {
      this.addLinkSuggestions(input)
    })

    // Watch for dynamically added forms
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const newUrlInputs = node.querySelectorAll(
              'input[type="url"], input[name*="url"], input[placeholder*="url"], input[placeholder*="link"], input[id*="url"], input[id*="link"]',
            )
            newUrlInputs.forEach((input) => {
              this.addLinkSuggestions(input)
            })
          }
        })
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  addLinkSuggestions(input) {
    // Create suggestion dropdown
    const dropdown = document.createElement("div")
    dropdown.className = "links-plus-dropdown"
    dropdown.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-height: 200px;
            overflow-y: auto;
            z-index: 10000;
            display: none;
            min-width: 200px;
        `

    // Position dropdown
    input.parentNode.style.position = "relative"
    input.parentNode.appendChild(dropdown)

    // Show dropdown on focus
    input.addEventListener("focus", () => {
      this.showLinkSuggestions(input, dropdown)
    })

    // Hide dropdown on blur (with delay for clicking)
    input.addEventListener("blur", () => {
      setTimeout(() => {
        dropdown.style.display = "none"
      }, 200)
    })

    // Filter suggestions on input
    input.addEventListener("input", () => {
      this.filterLinkSuggestions(input, dropdown)
    })
  }

  showLinkSuggestions(input, dropdown) {
    if (this.links.length === 0) return

    dropdown.innerHTML = ""

    // Add header
    const header = document.createElement("div")
    header.style.cssText = `
            padding: 8px 12px;
            background: #f5f5f5;
            font-weight: bold;
            font-size: 12px;
            color: #666;
            border-bottom: 1px solid #eee;
        `
    header.textContent = "Links++ Suggestions"
    dropdown.appendChild(header)

    // Add link suggestions
    this.links.slice(0, 10).forEach((link) => {
      const item = document.createElement("div")
      item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            `
      item.innerHTML = `
                <div style="font-weight: 500; margin-bottom: 2px;">${link.title}</div>
                <div style="font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${link.url}</div>
            `

      item.addEventListener("click", () => {
        input.value = link.url
        input.dispatchEvent(new Event("input", { bubbles: true }))
        dropdown.style.display = "none"
      })

      item.addEventListener("mouseenter", () => {
        item.style.background = "#f0f0f0"
      })

      item.addEventListener("mouseleave", () => {
        item.style.background = "white"
      })

      dropdown.appendChild(item)
    })

    dropdown.style.display = "block"

    // Position dropdown
    const rect = input.getBoundingClientRect()
    dropdown.style.top = rect.height + 2 + "px"
    dropdown.style.left = "0px"
    dropdown.style.width = Math.max(rect.width, 200) + "px"
  }

  filterLinkSuggestions(input, dropdown) {
    const query = input.value.toLowerCase()
    if (!query) {
      this.showLinkSuggestions(input, dropdown)
      return
    }

    const filteredLinks = this.links.filter(
      (link) => link.title.toLowerCase().includes(query) || link.url.toLowerCase().includes(query),
    )

    dropdown.innerHTML = ""

    if (filteredLinks.length === 0) {
      dropdown.style.display = "none"
      return
    }

    // Add header
    const header = document.createElement("div")
    header.style.cssText = `
            padding: 8px 12px;
            background: #f5f5f5;
            font-weight: bold;
            font-size: 12px;
            color: #666;
            border-bottom: 1px solid #eee;
        `
    header.textContent = `Links++ (${filteredLinks.length} matches)`
    dropdown.appendChild(header)

    // Add filtered suggestions
    filteredLinks.slice(0, 10).forEach((link) => {
      const item = document.createElement("div")
      item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            `

      // Highlight matching text
      const titleHighlighted = this.highlightText(link.title, query)
      const urlHighlighted = this.highlightText(link.url, query)

      item.innerHTML = `
                <div style="font-weight: 500; margin-bottom: 2px;">${titleHighlighted}</div>
                <div style="font-size: 12px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${urlHighlighted}</div>
            `

      item.addEventListener("click", () => {
        input.value = link.url
        input.dispatchEvent(new Event("input", { bubbles: true }))
        dropdown.style.display = "none"
      })

      item.addEventListener("mouseenter", () => {
        item.style.background = "#f0f0f0"
      })

      item.addEventListener("mouseleave", () => {
        item.style.background = "white"
      })

      dropdown.appendChild(item)
    })

    dropdown.style.display = "block"
  }

  highlightText(text, query) {
    const regex = new RegExp(`(${query})`, "gi")
    return text.replace(regex, '<mark style="background: #ffeb3b; padding: 0;">$1</mark>')
  }

  createFloatingButton() {
    const button = document.createElement("div")
    button.id = "links-plus-floating-btn"
    button.innerHTML = "🔗"
    button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: #6366f1;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-size: 20px;
            transition: all 0.3s ease;
            opacity: 0.8;
        `

    button.addEventListener("mouseenter", () => {
      button.style.opacity = "1"
      button.style.transform = "scale(1.1)"
    })

    button.addEventListener("mouseleave", () => {
      button.style.opacity = "0.8"
      button.style.transform = "scale(1)"
    })

    button.addEventListener("click", () => {
      this.showQuickAddModal()
    })

    document.body.appendChild(button)

    // Hide button when not needed
    let hideTimeout
    const showButton = () => {
      button.style.display = "flex"
      clearTimeout(hideTimeout)
      hideTimeout = setTimeout(() => {
        if (!document.querySelector(".links-plus-modal")) {
          button.style.display = "none"
        }
      }, 5000)
    }

    // Show button when URL inputs are detected
    document.addEventListener("focusin", (e) => {
      if (
        e.target.matches('input[type="url"], input[name*="url"], input[placeholder*="url"], input[placeholder*="link"]')
      ) {
        showButton()
      }
    })

    // Initially hide the button
    button.style.display = "none"
  }

  showQuickAddModal() {
    // Remove existing modal
    const existingModal = document.querySelector(".links-plus-modal")
    if (existingModal) {
      existingModal.remove()
    }

    const modal = document.createElement("div")
    modal.className = "links-plus-modal"
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `

    const modalContent = document.createElement("div")
    modalContent.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            width: 400px;
            max-width: 90vw;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        `

    modalContent.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #333;">Quick Add Link</h3>
            <form id="quickAddForm">
                <input type="text" id="quickTitle" placeholder="Link Title" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px;" required>
                <input type="url" id="quickUrl" placeholder="https://example.com" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px;" required>
                <select id="quickCategory" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px;" required>
                    <option value="">Select Category</option>
                    <option value="social">Social Media</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="tools">Tools</option>
                    <option value="other">Other</option>
                </select>
                <div style="display: flex; gap: 10px;">
                    <button type="submit" style="flex: 1; padding: 10px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer;">Add Link</button>
                    <button type="button" id="quickCancel" style="flex: 1; padding: 10px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                </div>
            </form>
        `

    modal.appendChild(modalContent)
    document.body.appendChild(modal)

    // Pre-fill with current page info
    document.getElementById("quickTitle").value = document.title
    document.getElementById("quickUrl").value = window.location.href

    // Handle form submission
    document.getElementById("quickAddForm").addEventListener("submit", async (e) => {
      e.preventDefault()

      const title = document.getElementById("quickTitle").value.trim()
      const url = document.getElementById("quickUrl").value.trim()
      const category = document.getElementById("quickCategory").value

      if (!title || !url || !category) return

      const newLink = {
        id: Date.now().toString(),
        title,
        url,
        category,
        description: "Added from page",
        createdAt: new Date().toISOString(),
        clickCount: 0,
      }

      // Send message to background script
      chrome.runtime.sendMessage(
        {
          action: "addLink",
          link: newLink,
        },
        (response) => {
          if (response && response.success) {
            this.showToast("Link added successfully!")
            modal.remove()
          }
        },
      )
    })

    // Handle cancel
    document.getElementById("quickCancel").addEventListener("click", () => {
      modal.remove()
    })

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove()
      }
    })

    // Focus first input
    document.getElementById("quickTitle").focus()
  }

  showToast(message) {
    const toast = document.createElement("div")
    toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10002;
            font-size: 14px;
            font-weight: 500;
        `
    toast.textContent = message
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.remove()
    }, 3000)
  }
}

// Initialize content manager
new ContentManager()
