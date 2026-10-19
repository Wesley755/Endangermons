module GamePlay
    class << self
        # class attribute references the scene class
        attr_accessor :field_notes_class
        
        # Open the field note scene
        def open_field_notes
            return current_scene.call_scene(field_notes_class)
        end
    end
end