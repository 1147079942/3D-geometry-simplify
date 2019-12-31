# 3D-geometry-simplify
 a simplify algorithm to reduce trangles number
 
# how to use
 1.if the test script work,you can execute the follow command
 
 <code>node ./src/bin/3DGeometrySimplify.js gltf -f ./resource/cup-metalblue.gltf  -o ./resource/cup-metalblue_1.gltf -m QuadricError -q 0.5</code>
 
 2.install node command
 
 install node.js first
 
 than run the install command
 
 <code>npm i 3d-geometry-simplify -g</code>
 
 3.use the command
 
 <code>3DGeometrySimplify</code>
 
 4.example
 
 <code>3DGeometrySimplify gltf -f ./resource/cup-metalblue.gltf  -o ./resource/cup-metalblue_1.gltf -m QuadricError -q 0.5</code>
 <code>3DGeometrySimplify obj -f ./resource/model.obj  -o ./resource/model_1.obj -m VertexClustering -s 5 -n 60</code>
 
 5.support list
 
 <li>
  1.gltf
 </li>
 <li>
  2.obj
 </li>
 
 6.future
 
 support more open format model file
 <li>fbx</li>

7.model on line check

  [model_viewer](http://suit_min_h.gitee.io/model_viewer/)
  
  support format 
  
  <li>obj</li>
  <li>fbx</li>
  <li>gltf</li>
  <li>b3dm</li>
  
8.if you are the using gltf-simplify
 please replace to this tool,gltf-simplify will not update anymore 