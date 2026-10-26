"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Largeur réelle d'un conteneur, en pixels.
 *
 * Les graphiques sont tracés dans un `viewBox` qui vaut exactement cette largeur :
 * une unité SVG = un pixel écran. Sans cela, un `viewBox` fixe de 720 unités
 * affiché dans 340 px réduit le texte des axes à cinq pixels sur un téléphone.
 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
