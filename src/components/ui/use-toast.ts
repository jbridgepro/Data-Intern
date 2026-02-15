import { useState, useEffect } from "react"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = any // Simplified for brevity in this context

let count = 0

function genId() {
    count = (count + 1) % Number.MAX_SAFE_INTEGER
    return count.toString()
}

type ActionType = {
    ADD_TOAST: "ADD_TOAST"
    UPDATE_TOAST: "UPDATE_TOAST"
    DISMISS_TOAST: "DISMISS_TOAST"
    REMOVE_TOAST: "REMOVE_TOAST"
}

let memoryState: any = { toasts: [] }

function dispatch(action: any) {
    memoryState = { ...memoryState, toasts: [...memoryState.toasts, action.toast].slice(0, TOAST_LIMIT) }
    listeners.forEach((listener) => {
        listener(memoryState)
    })
}

const listeners: Array<(state: any) => void> = []

function toast({ ...props }: any) {
    const id = genId()

    const update = (props: any) =>
        dispatch({
            type: "UPDATE_TOAST",
            toast: { ...props, id },
        })
    const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

    dispatch({
        type: "ADD_TOAST",
        toast: {
            ...props,
            id,
            open: true,
            onOpenChange: (open: boolean) => {
                if (!open) dismiss()
            },
        },
    })

    return {
        id: id,
        dismiss,
        update,
    }
}

function useToast() {
    const [state, setState] = useState<any>(memoryState)

    useEffect(() => {
        listeners.push(setState)
        return () => {
            const index = listeners.indexOf(setState)
            if (index > -1) {
                listeners.splice(index, 1)
            }
        }
    }, [state])

    return {
        ...state,
        toast,
        dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
    }
}

export { useToast, toast }
