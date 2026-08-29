import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'

export function UploadZone({ onProcess, loading, uploadProgress }) {
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])

  const onDrop = useCallback((accepted) => {
    setFiles(accepted)
    const urls = accepted.map(f => URL.createObjectURL(f))
    setPreviews(urls)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple: true,
    maxFiles: 20,
    disabled: loading,
  })

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleProcess = () => {
    if (files.length > 0) onProcess(files)
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive
            ? 'border-red-500 bg-red-500/10'
            : 'border-gray-600 hover:border-red-400 hover:bg-gray-800/50'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 text-red-400" size={40} />
        <p className="text-lg font-semibold text-gray-200">
          {isDragActive ? 'Drop images here...' : 'Drag & drop conveyor snapshots'}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          JPG, PNG, WebP  &bull;  Up to 20 images per batch
        </p>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {previews.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden bg-gray-800 aspect-square">
              <img src={url} alt={files[i]?.name} className="w-full h-full object-cover" />
              <button
                onClick={() => removeFile(i)}
                className="absolute top-1 right-1 bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                <p className="text-xs text-gray-300 truncate">{files[i]?.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleProcess}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700
              disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl
              transition-colors duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Processing {uploadProgress > 0 ? `(${uploadProgress}%)` : '...'}
              </>
            ) : (
              <>
                <ImageIcon size={20} />
                Analyze {files.length} Image{files.length > 1 ? 's' : ''}
              </>
            )}
          </button>
          {!loading && (
            <button
              onClick={() => { setFiles([]); setPreviews([]) }}
              className="px-4 py-3 rounded-xl border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {loading && uploadProgress > 0 && (
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-red-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: uploadProgress + '%' }}
          />
        </div>
      )}
    </div>
  )
}
